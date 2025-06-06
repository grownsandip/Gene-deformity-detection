'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { fetchGenomeDetails, type GeneBoundsType, type GeneDetailsType, type GeneType ,fetchGeneSequence as apiFetchGeneSequence, type ClinicalVariants,fetchClinicalVariants as apiFetchClinicalVariants} from '~/utils/genome-api'
import { Button } from './ui/button'
import { ArrowLeft } from 'lucide-react'
import GeneInformation from './geneInformation';
import GeneSequence from './geneSequence';
import KnownVariants from './knownVariants';
import VariantComparisonModal from './variantComparisonModal';
import VariantAnalysis, { type VariantAnalysisHandle } from './variantAnalysis';
import { Viaoda_Libre } from 'next/font/google';
import { positive } from 'zod/v4';



const GeneViewer = ({gene,genomeId,onClose}:{gene:GeneType,genomeId:string,onClose:()=>void}) => {
    const [geneDetail,setGeneDetail]=useState<GeneDetailsType |null>(null);
    const [geneBounds,setGeneBounds]=useState<GeneBoundsType |null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [startPosition,setStartPosition] = useState<string>("");
    const [endPosition,setEndPosition] = useState<string>("");
    const [geneSequence,setGeneSequence]=useState("");
    const [isLoadingSequnce,setIsLoadingSequence]=useState(false);
    const [actualRange,setActualRange]=useState<{start:number,end:number}| null>(null);
    const [clinicalVariant,setClinicalVariants]=useState<ClinicalVariants[]>([])
    const [isLoadingclinicalVar,setIsLoadingClinicalVar]=useState(false);
    const [clinicalVarError,setClinicalVarError]=useState<string  | null>(null);
    const [comparisonVariant,setComparisonVariant]=useState<ClinicalVariants|null>(null);
    const [activeSeqPos,setActiveSeqPos]=useState<number |null>(null);
    const [activeRefNuc,setActiveRefNuc]=useState<string |null>(null);

    const variantAnalysisRef=useRef<VariantAnalysisHandle>(null);

    const handleSequenceClick=useCallback((position:number,nucleotide:string)=>{
         setActiveSeqPos(position);
         setActiveRefNuc(nucleotide);
         window.scrollTo({behavior:"smooth",top:0})
         if(variantAnalysisRef.current){
           variantAnalysisRef.current.focusAlternativeInput();
         }
    },[])
    const fetchGeneSequence=useCallback(async(start:number,end:number)=>{
      try {
        setIsLoadingSequence(true);
        setError(null);
        const {sequence,actualRange:fetchedRange,error:apiError}=await apiFetchGeneSequence(gene.chrom,start, end, genomeId);
        setGeneSequence(sequence);
        setActualRange(fetchedRange);
        if(apiError){
          setError(apiError);
        }
        //console.log(sequence);
      } catch (err) {
        setError("Failed to load sequence data");
        //console.log(err)
      }
      finally{
        setIsLoadingSequence(false);
      }

    },[gene.chrom,genomeId])

    const handleLoadSequence=useCallback(()=>{
       const start=parseInt(startPosition);
       const end=parseInt(endPosition);
       let validationError:string|null=null;
       if(isNaN(start) || isNaN(end)){
         validationError="Please enter a valid start and end sequence";
       }else if(start>=end){
          validationError="Start must be less than end Position";
       }else if(geneBounds){
        const minBound=Math.min(geneBounds.min,geneBounds.max);
        const maxBound=Math.max(geneBounds.min,geneBounds.max);
        if(start<minBound){
          validationError=`Start position (${start.toLocaleString()}) is below the minimum bound (${minBound.toLocaleString()})`
        }else if(end>maxBound){
          validationError=`End position (${end.toLocaleString()}) exceeds the maximum bound (${maxBound.toLocaleString()})`
        }
        if(end-start>10000){
          validationError=`Selected range exceeds maximum value of 10.000 b.p`;
        }
       }
       if(validationError){
        setError(validationError);
        return null;
       }
      setError(null);
      fetchGeneSequence(start,end);

    },[startPosition,endPosition,geneBounds,fetchGeneSequence])


    useEffect(()=>{
     const initializeGeneData=async ()=>{
       setIsLoading(true);
       setError(null);
       setGeneDetail(null);
       setStartPosition("");
       setEndPosition("");

       if(!gene.gene_id){
        setError("Gene id is missing,cannot fetch genedetails");
        setIsLoading(false);
        return ;
       }
       try {
        const {geneDetails:fetchedGeneDetails,geneBound:fetchedGeneBound,initialRange:fetchedRange}=await fetchGenomeDetails(gene.gene_id);
        setGeneDetail(fetchedGeneDetails);
        setGeneBounds(fetchedGeneBound);
        if(fetchedRange){
            setStartPosition(String(fetchedRange.start));
            setEndPosition(String(fetchedRange.end));
            await fetchGeneSequence(fetchedRange.start,fetchedRange.end);
        }
        //console.log(fetchedGeneDetails)
       } catch(err) {
        setError("Failed to fetch gene information.Please try again.")
        //console.log(err)
       }
       finally{
        setIsLoading(false);
       }
     }
     initializeGeneData()
    },[gene,genomeId])

    const fetchClinicalVariants=async ()=>{
      if(!geneBounds || !gene.chrom){
        return ;
      }
      setIsLoadingClinicalVar(true);
      setClinicalVarError(null);
      try {
        const variants=await apiFetchClinicalVariants(gene.chrom,geneBounds,genomeId);
        setClinicalVariants(variants);
        console.log(variants);
      } catch (error) {
        console.log(error)
        setClinicalVarError("Failed to fetch clinical variants.");
        setClinicalVariants([]);
      }finally{
         setIsLoadingClinicalVar(false);
      }
    };
    useEffect(()=>{
      if(geneBounds){
        fetchClinicalVariants();
      }
    },[geneBounds])
    const updateClinicalVariants=(clinvar_id:string,updateVariant:ClinicalVariants)=>{
      setClinicalVariants((currVar)=>currVar.map((v)=>v.clinvar_id===clinvar_id?updateVariant:v))
    }
    const showComparison=(variant:ClinicalVariants)=>{
      if(variant.evo2Result){
        setComparisonVariant(variant)
      }
    }
    if(isLoading){
      return (
        <div className='flex h-64 items-center justify-center'>
          <div className='h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800'></div>
        </div>
      )
    }
  return (
    <div className='space-y-6'>
        <Button variant="ghost" size="sm" className='cursor-pointer text-[#3c4f3d] hover:bg-[#e9eeea]' onClick={onClose}>
            <ArrowLeft className='mr-2 h-4 w-4'/>
            back to results
        </Button>
        <VariantAnalysis gene={gene} genomeId={genomeId} chromosome={gene.chrom} clinicalVariants={clinicalVariant} referenceSequence={activeRefNuc} sequencePosition={activeSeqPos} geneBounds={geneBounds} ref={variantAnalysisRef}/>
        <KnownVariants refreshVariants={fetchClinicalVariants} showComparison={showComparison} updateClinicalVariants={updateClinicalVariants} clinicalVariants={clinicalVariant} isLoadingClinVar={isLoadingclinicalVar} clinvarError={clinicalVarError} genomeId={genomeId} gene={gene}/>
        <GeneSequence geneBounds={geneBounds} geneDetail={geneDetail} startPosition={startPosition} endPosition={endPosition} onStartPositonChange={setStartPosition} onEndPositonChange={setEndPosition} sequenceData={geneSequence} sequenceRange={actualRange} isLoading={isLoadingSequnce} error={error} onSequenceLoadRequest={handleLoadSequence} onSequenceClick={handleSequenceClick} maxViewRange={10000}/>
        <GeneInformation gene={gene} geneDetails={geneDetail} geneBounds={geneBounds}/>
        <VariantComparisonModal comparisonVariant={comparisonVariant} onClose={()=>setComparisonVariant(null)}/>
    </div>
  )
}

export default GeneViewer
