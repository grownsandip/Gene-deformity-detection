import sys

import modal
#defining docker image
evo2_image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.0-devel-ubuntu22.04",add_python="3.12"#starts with base image ubuntu with cuda
    )
    .apt_install(
        ["build-essential","cmake","ninja-build","libcudnn8","libcudnn8-dev","git","gcc","g++"]
    )
    .env({
        "CC":"/usr/bin/gcc",
        "CXX":"/usr/bin/g++",
    })
    .run_commands("git clone --recurse-submodules https://github.com/ArcInstitute/evo2.git && cd evo2 && pip install .") #clone git repo in conatiner and installs the setup file
    .run_commands("pip uninstall -y transformer-engine transformer-engine")
    .run_commands("pip install 'transformer_engine[pytorch]==1.13' --no-build-isolation")
    .pip_install_from_requirements("requirements.txt")
)


app = modal.App("variant_analysis_evo2",image=evo2_image)

volume=modal.Volume.from_name("hf_cache",create_if_missing=True)

mount_path="/root/.cache/huggingface" #downloading evo2 checkpoints from hugging face

@app.function(gpu="H100",volumes={mount_path:volume},timeout=1000)
def run_brca1_analysis():
    print("Run brca 1 analysis")
    from Bio import SeqIO
    import base64
    from io import BytesIO
    import gzip
    import matplotlib.pyplot as plt
    import numpy as np
    import pandas as pd
    import os
    import seaborn as sns
    from sklearn.metrics import roc_auc_score,roc_curve
    from evo2 import Evo2
    WINDOW_SIZE=8192
    print("loading evo2 model...")
    model=Evo2('evo2_7b')
    print("Evo2 model loaded!")
    
    brca1_df = pd.read_excel('/evo2/notebooks/brca1/41586_2018_461_MOESM3_ESM.xlsx',header=2)
    brca1_df = brca1_df[[
        'chromosome', 'position (hg19)', 'reference', 'alt', 'function.score.mean', 'func.class',
    ]]
    brca1_df.rename(columns={
    'chromosome': 'chrom',
    'position (hg19)': 'pos',
    'reference': 'ref',
    'alt': 'alt',
    'function.score.mean': 'score',
    'func.class': 'class',
    }, inplace=True)

# Convert to two-class system
    brca1_df['class'] = brca1_df['class'].replace(['FUNC', 'INT'], 'FUNC/INT')
    
    with gzip.open('/evo2/notebooks/brca1/GRCh37.p13_chr17.fna.gz', "rt") as handle:
     for record in SeqIO.parse(handle, "fasta"):
        seq_chr17 = str(record.seq)
        break
    ref_seqs = []
    ref_seq_to_index = {}

    # Parse sequences and store indexes
    ref_seq_indexes = []
    var_seqs = []
    brca1_subset=brca1_df.iloc[:500].copy()

    for _, row in brca1_subset.iterrows():
        p = row["pos"] - 1 # Convert to 0-indexed position
        full_seq = seq_chr17

        ref_seq_start = max(0, p - WINDOW_SIZE//2)
        ref_seq_end = min(len(full_seq), p + WINDOW_SIZE//2)
        ref_seq = seq_chr17[ref_seq_start:ref_seq_end]
        snv_pos_in_ref = min(WINDOW_SIZE//2, p)
        var_seq = ref_seq[:snv_pos_in_ref] + row["alt"] + ref_seq[snv_pos_in_ref+1:]


        # Get or create index for reference sequence
        if ref_seq not in ref_seq_to_index:
            ref_seq_to_index[ref_seq] = len(ref_seqs)
            ref_seqs.append(ref_seq)
        
        ref_seq_indexes.append(ref_seq_to_index[ref_seq])
        var_seqs.append(var_seq)

    ref_seq_indexes = np.array(ref_seq_indexes)

    print(f'Scoring likelihoods of {len(ref_seqs)} reference sequences with Evo 2...')
    ref_scores = model.score_sequences(ref_seqs)

    print(f'Scoring likelihoods of {len(var_seqs)} variant sequences with Evo 2...')
    var_scores = model.score_sequences(var_seqs)
    
    delta_scores = np.array(var_scores) - np.array(ref_scores)[ref_seq_indexes]

    # Add delta scores to dataframe
    brca1_subset[f'evo2_delta_score'] = delta_scores
    # Calculate AUROC of zero-shot predictions
    y_true = (brca1_subset['class'] == 'LOF')
    auroc = roc_auc_score(y_true, -brca1_subset['evo2_delta_score'])

    #------threshold start
    y_true=(brca1_subset["class"]=='LOF')
    fpr,tpr,thresholds=roc_curve(y_true,-brca1_subset["evo2_delta_score"])
    optimal_idx=(tpr-fpr).argmax()
    optimal_thresholds=-thresholds[optimal_idx]
    lof_scores=brca1_subset.loc[brca1_subset["class"]=="LOF","evo2_delta_score"]
    func_scores=brca1_subset.loc[brca1_subset["class"]=="FUNC/INT","evo2_delta_score"]
    lof_std=lof_scores.std()
    func_std=func_scores.std()
    confidence_params={
        "threshold":optimal_thresholds,
        "lof_std":lof_std,
        "func_std":func_std,
    }
    print("confidence params:",confidence_params)
    #------threshold end
    
    plt.figure(figsize=(4, 2))

# Plot stripplot of distributions
    p = sns.stripplot(
        data=brca1_subset,
        x='evo2_delta_score',
        y='class',
        hue='class',
        order=['FUNC/INT', 'LOF'],
        palette=['#777777', 'C3'],
        size=2,
        jitter=0.3,
)

# Mark medians from each distribution
    sns.boxplot(showmeans=True,
            meanline=True,
            meanprops={'visible': False},
            medianprops={'color': 'k', 'ls': '-', 'lw': 2},
            whiskerprops={'visible': False},
            zorder=10,
            x="evo2_delta_score",
            y="class",
            data=brca1_subset,
            showfliers=False,
            showbox=False,
            showcaps=False,
            ax=p)
    plt.xlabel('Delta likelihood score, Evo 2')
    plt.ylabel('BRCA1 SNV class')
    plt.tight_layout()
    
    buffer=BytesIO()
    plt.savefig(buffer,format='png')
    buffer.seek(0)
    plot_data=base64.b64encode(buffer.getvalue()).decode("utf-8")
    return {"variants":brca1_subset.to_dict(orient="records"),"plot":plot_data,"auroc":auroc}
    
@app.function()
def brca1_example():
    print("Run brca 1 analysis")
    import base64
    import matplotlib.pyplot as plt
    import matplotlib.image as mpimg
    from io import BytesIO
    #inference
    results=run_brca1_analysis.remote()
    if "plot" in results:
        plot_data=base64.b64decode(results["plot"])
        with open("brca1_analysis_plot.png","wb") as f:
            f.write(plot_data)
        img=mpimg.imread(BytesIO(plot_data))
        plt.figure(figsize=(10,5))
        plt.imshow(img)
        plt.axis("off")
        plt.show()
def get_genome_sequence(position,genome:str,chromosome:str,window_size=8192):
    import requests
    half_window=window_size//2
    start=max(0,position-half_window-1)
    end=position-1+half_window+1
    print(f"Fetching {window_size} bp window around position {position} from UCSC api...")
    print(f"Coordinates:{chromosome}:{start}-{end} ({genome})")
    
    api_url=f"https://api.genome.ucsc.edu/getData/sequence?genome={genome};chrom={chromosome};start={start};end={end}"
    response=requests.get(api_url)
    if response.status_code!=200:
        raise Exception(f"Failed to fetch genome from UCSC api:{response.status_code}")
    
    genome_data=response.json()
    
    if "dna" not in genome_data:
        error=genome_data.get("error","Unknown error")
        raise Exception(f"UCSC API error:{error}")
    sequence=genome_data.get("dna","").upper()
    expected_length=end-start
    if len(sequence)!=expected_length:
        print(f"Warning: Recieved sequence length ({len(sequence)}) differs from expeceted ({expected_length}).")
    print(f"Loaded reference genome sequence  window (length:{len(sequence)} bases)")
    return sequence,start

def analyze_variant(relative_pos_in_window,reference,alternative,window_seq,model):
    var_seq=window_seq[:relative_pos_in_window]+alternative+window_seq[relative_pos_in_window+1:]
    ref_score=model.score_sequences([window_seq])[0]
    var_score=model.score_sequences([var_seq])[0]
    delta_score=var_score-ref_score
    threshold=-0.0009178519
    lof_std=0.0015140239
    func_std=0.0009016589
    
    if delta_score<threshold:
        prediction="Likely pathogenic"
        confidence=min(1.0,abs(delta_score-threshold)/lof_std)
    else:
        prediction="Likely benign"
        confidence=min(1.0,abs(delta_score-threshold)/func_std)
    return {
        "reference":reference,
        "alternative":alternative,
        "delta_score":float(delta_score),
        "prediction":prediction,
        "classification_confidence":float(confidence)
    }
        
    # confidence params: {'threshold': np.float32(-0.0009178519), 'lof_std': np.float32(0.0015140239), 'func_std': np.float32(0.0009016589)}
@app.cls(gpu="H100",volumes={mount_path:volume},max_containers=3,retries=2,scaledown_window=120)
class Evo2Model:
    @modal.enter() #entrypoint  
    def load_evo2_model(self):
        from evo2 import Evo2
        print("loading evo2 model...")
        self.model=Evo2('evo2_7b')
        print("Evo2 model loaded!")
         
    #@modal.method() 
    @modal.fastapi_endpoint(method="POST")   
    def analyze_single_variant(self ,variant_position:int,alternative:str,genome:str,chromosome:str):
        print("Genome:",genome)
        print("chromosome:",chromosome)
        print("Variant position:",variant_position)
        print("Variant alternative:",alternative)
        
        WINDOW_SIZE=8192
        
        window_seq,seq_start=get_genome_sequence(position=variant_position,genome=genome,chromosome=chromosome,window_size=WINDOW_SIZE)
        print(f"Fetched genome sequence window,first 100:{window_seq[:100]}")
        relative_po=variant_position-1-seq_start
        print(f"Relative position within window:{relative_po}")
        if relative_po<0 or relative_po>=len(window_seq):
            raise ValueError(f"Variant position {variant_position} is outside the fetched window (start={seq_start+1},end={seq_start+len(window_seq)})")
        reference=window_seq[relative_po]
        print("Reference is :",reference)
        #Analyze the variant
        result=analyze_variant(relative_pos_in_window=relative_po,reference=reference,alternative=alternative,window_seq=window_seq,model=self.model)
        result["position"]=variant_position
        return result

# @app.function()
# def f(i):
#     if i % 2 == 0:
#         print("hello", i)
#     else:
#         print("world", i, file=sys.stderr)

#     return i * i

@app.local_entrypoint()
def main():
    #brca1_example.remote()
    evo2model=Evo2Model()
    result=evo2model.analyze_single_variant.remote(variant_position=43119628,alternative="G",genome="hg38",chromosome="chr17")
    
