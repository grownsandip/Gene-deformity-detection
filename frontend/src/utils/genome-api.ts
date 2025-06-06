import { env } from "~/env";

export interface GenomeAssemblyType {
  id: string;
  sourceName: string;
  name: string;
  active: boolean;
}
export interface ChrormosomeType {
  name: string;
  size: number;
}
export interface GeneType {
  symbol: string;
  name: string;
  chrom: string;
  description: string;
  gene_id?: string;
}
export interface GeneDetailsType {
  genomicinfo?: {
    chrstart: number;
    chrstop: number;
    strand?: string;
  }[];
  summary?: string;
  organism?: {
    scientificname: string;
    commonname: string;
  };
}
export interface GeneBoundsType {
  min: number;
  max: number;
}
export interface analysisResultsType{
  position:number;
  alternative:string;
  reference:string;
  delta_score:number;
  prediction:string;
  classification_confidence:number;
}
export interface ClinicalVariants {
  clinvar_id: string;
  title: string;
  variation_type: string;
  classification: string;
  gene_sort: string;
  chromosome: string;
  location: string;
  evo2Result?:{
    prediction:string;
    delta_score:number;
    classification_confidence:number;
  };
  isAnalyzing?:boolean;
  evo2Error?:string;
}
export async function getAvailableGenomes() {
  const apiUrl = "https://api.genome.ucsc.edu/list/ucscGenomes";
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch Genome from UCSC.");
  }
  const genomeData = await response.json();
  if (!genomeData.ucscGenomes) {
    throw new Error("UCSC API error:missing UCSC genomes");
  }
  const genomes = genomeData.ucscGenomes;
  const structuredGenomes: Record<string, GenomeAssemblyType[]> = {};
  for (const genomeId in genomes) {
    const genomeInfo = genomes[genomeId];
    const organism = genomeInfo.organism || "other";
    if (!structuredGenomes[organism]) structuredGenomes[organism] = [];
    structuredGenomes[organism].push({
      id: genomeId,
      sourceName: genomeInfo.sourceName || genomeId,
      name: genomeInfo.description || genomeId,
      active: !!genomeInfo.active,
    });
  }
  return { genomes: structuredGenomes };
}

export async function getGenomeChromosomes(genomeId: string) {
  const apiUrl = `https://api.genome.ucsc.edu/list/chromosomes?genome=${genomeId}`;
  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch chromosomes list from UCSC api");
  }
  const chromoData = await response.json();
  if (!chromoData.chromosomes) {
    throw new Error("UCSC api error:Missing Chromosomes.");
  }
  const chromosomes: ChrormosomeType[] = [];
  for (const chromId in chromoData.chromosomes) {
    if (
      chromId.includes("_") ||
      chromId.includes("Un") ||
      chromId.includes("random")
    )
      continue;
    chromosomes.push({
      name: chromId,
      size: chromoData.chromosomes[chromId],
    });
  }
  chromosomes.sort((a, b) => {
    const anum = a.name.replace("chr", "");
    const bnum = b.name.replace("chr", "");
    const isNumA = /^\d+$/.test(anum);
    const isNumB = /^\d+$/.test(bnum);
    if (isNumA && isNumB) return Number(anum) - Number(bnum);
    if (isNumA) return -1;
    if (isNumB) return 1;
    return anum.localeCompare(bnum);
  });
  return { chromosomes };
}

export async function searchGenes(query: string, genome: string) {
  const url = "https://clinicaltables.nlm.nih.gov/api/ncbi_genes/v3/search";
  const params = new URLSearchParams({
    terms: query,
    df: "chromosome,Symbol,description,map_location,type_of_gene",
    ef: "chromosome,Symbol,description,map_location,type_of_gene,GenomicInfo,GeneID",
  });
  const response = await fetch(`${url}?${params}`);
  if (!response.ok) {
    throw new Error("NCBI API error");
  }
  const data = await response.json();
  //console.log(data)
  const result: GeneType[] = [];
  if (data[0] > 0) {
    const FieldMap = data[2];
    const geneIds = FieldMap.GeneID || [];
    for (let i = 0; i < Math.min(10, data[0]); ++i) {
      if (i < data[3].length) {
        try {
          const display = data[3][i];
          let chrom = display[0];
          if (chrom && !chrom.startsWith("chr")) {
            chrom = `chr${chrom}`;
          }
          result.push({
            symbol: display[2],
            name: display[3],
            chrom,
            description: display[3],
            gene_id: geneIds[i] || "",
          });
          //console.log(result)
        } catch {
          continue;
        }
      }
    }
  }
  return { query, genome, result };
}

export async function fetchGenomeDetails(
  geneId: string,
): Promise<{
  geneDetails: GeneDetailsType | null;
  geneBound: GeneBoundsType | null;
  initialRange: { start: number; end: number } | null;
}> {
  try {
    const detailUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=gene&id=${geneId}&retmode=json`;
    const detailResponse = await fetch(detailUrl);
    if (!detailResponse.ok) {
      console.error(
        `failed to fetch gene details ${detailResponse.statusText}`,
      );
      return { geneDetails: null, geneBound: null, initialRange: null };
    }
    const detailData = await detailResponse.json();
    if (detailData.result && detailData.result[geneId]) {
      const detail = detailData.result[geneId];
      if (detail.genomicinfo && detail.genomicinfo.length > 0) {
        const info = detail.genomicinfo[0];
        const minPos = Math.min(info.chrstart, info.chrstop);
        const maxPos = Math.max(info.chrstart, info.chrstop);
        const bounds = { min: minPos, max: maxPos };
        const geneSize = maxPos - minPos;
        const seqStart = minPos;
        const seqEnd = geneSize > 10000 ? minPos + 10000 : maxPos;
        const range = { start: seqStart, end: seqEnd };

        return { geneDetails: detail, geneBound: bounds, initialRange: range };
      }
    }
    return { geneDetails: null, geneBound: null, initialRange: null };
  } catch (error) {
    return { geneDetails: null, geneBound: null, initialRange: null };
  }
}

export async function fetchGeneSequence(
  chrom: string,
  start: number,
  end: number,
  genomeId: string,
): Promise<{
  sequence: string;
  actualRange: { start: number; end: number };
  error?: string;
}> {
  try {
    const chromosome = chrom.startsWith("chr") ? chrom : `chr${chrom}`;
    const apiStart = start - 1;
    const apiEnd = end;
    const apiUrl = `https://api.genome.ucsc.edu/getData/sequence?genome=${genomeId};chrom=${chromosome};start=${apiStart};end=${apiEnd}`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    //console.log(data)
    const actualRange = { start, end };
    if (data.error || !data.dna) {
      return { sequence: "", actualRange, error: data.error };
    }
    const sequence = data.dna.toUpperCase();
    return { sequence, actualRange };
  } catch (error) {
    return {
      sequence: "",
      actualRange: { start, end },
      error: "internal Error in fetching gene sequence",
    };
  }
}

export async function fetchClinicalVariants(
  chrom: string,
  geneBounds: GeneBoundsType,
  genomeId: string,
): Promise<ClinicalVariants[]> {
  const chromFormatted = chrom.replace(/^chr/i, "");
  const minBound = Math.min(geneBounds.min, geneBounds.max);
  const maxBound = Math.max(geneBounds.min, geneBounds.max);
  const positionField = genomeId === "hg19" ? "chrpos37" : "chrpos38";
  const searchTerm = `${chromFormatted}[chromosome] AND ${minBound}:${maxBound}[${positionField}]`;
  const apiUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
  const searchParams = new URLSearchParams({
    db: "clinvar",
    term: searchTerm,
    retmode: "json",
    retmax: "20",
  });
  const searchResponse = await fetch(`${apiUrl}?${searchParams.toString()}`);

  if (!searchResponse.ok) {
    throw new Error("Clinvar search failed:" + searchResponse.statusText);
  }
  const searchData = await searchResponse.json();
  if (
    !searchData.esearchresult ||
    !searchData.esearchresult.idlist ||
    searchData.esearchresult.idlist.length === 0
  ) {
    console.log("NO Clinvar variants found");
    return [];
  }
  const variantIds = searchData.esearchresult.idlist;
  //console.log("variant ids:",variantIds)

  const summaryUrl =
    "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";
  const summaryParams = new URLSearchParams({
    db: "clinvar",
    id: variantIds.join(","),
    retmode: "json",
  });

  const summaryResponse = await fetch(
    `${summaryUrl}?${summaryParams.toString()}`,
  );

  if (!summaryResponse.ok) {
    throw new Error(
      "Failed to fetch summary details:" + summaryResponse.statusText,
    );
  }
  const summaryData = await summaryResponse.json();
  const variants: ClinicalVariants[] = [];
  //console.log("Summary data:",summaryData);
  if (summaryData.result && summaryData.result.uids) {
    for (const id of summaryData.result.uids) {
      const variant = summaryData.result[id];
     // console.log("variant:",variant);
      variants.push({
        clinvar_id: id,
        title: variant.title,
        variation_type: (variant.obj_type || "Unknown")
          .split(" ")
          .map(
            (word: string) =>
              word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
          )
          .join(" "),
        classification:
          variant.germline_classification.description || "Unknown",
        gene_sort: variant.gene_sort || "",
        chromosome: chromFormatted,
        location: variant.location_sort
          ? parseInt(variant.location_sort).toLocaleString()
          : "Unknown",
      });
    }
  }
  //console.log("variants:",variants)
  return variants;
}
export async function analyzeVariantsWithAPI({position,alternative,genomeId,chromosome}:{position:number ;alternative:string;genomeId:string;chromosome:string}):Promise<analysisResultsType> {
  const queryParams=new URLSearchParams({
    variant_position:position.toString(),
    alternative:alternative,
    genome:genomeId,
    chromosome:chromosome,
  })
  const url=`${env.NEXT_PUBLIC_ANALYZE_SINGLE_VARIANT_BASE_URL}?${queryParams.toString()}`;
  console.log(url)
  const response=await fetch(url,{method:"POST"});
  if(!response.ok){
    const errorText=await response.text();
    throw new Error("Failed to analyze variant"+errorText);
  }
return await response.json();
}