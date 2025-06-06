"use client";
import React from 'react'
import { analyzeVariantsWithAPI, type ClinicalVariants, type GeneType } from '~/utils/genome-api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { BarChart2, ExternalLink, RefreshCcw, Search, Shield, Zap } from 'lucide-react';
import { getClassificationColorClasses } from '~/lib/coloringUtils';

const KnownVariants = ({ refreshVariants, showComparison, updateClinicalVariants, clinicalVariants, isLoadingClinVar, clinvarError, genomeId, gene }: { refreshVariants: () => void; showComparison: (variant: ClinicalVariants) => void; updateClinicalVariants: (id: string, newVariant: ClinicalVariants) => void; clinicalVariants: ClinicalVariants[]; isLoadingClinVar: boolean; clinvarError: string | null, genomeId: string; gene: GeneType }) => {
    const analyzeVariant = async (variant: ClinicalVariants) => {
        let variantDetails = null;
        const position = variant.location ? parseInt(variant.location.replaceAll(",", "")) : null;
        const refAltMatch = variant.title.match(/(\w)>(\w)/);
        if (refAltMatch && refAltMatch.length === 3) {
            variantDetails = {
                position,
                reference: refAltMatch[1],
                alternative: refAltMatch[2],
            }
        }
        if (!variantDetails || !variantDetails.reference || !variantDetails.alternative || !variantDetails.position) {
            return;
        }
        updateClinicalVariants(variant.clinvar_id, {
            ...variant,
            isAnalyzing: true,
        });
        try {
            const data = await analyzeVariantsWithAPI({ position: variantDetails.position, alternative: variantDetails.alternative, genomeId: genomeId, chromosome: gene.chrom });

            const updatedVariants: ClinicalVariants = {
                ...variant,
                isAnalyzing: false,
                evo2Result: data,
            };
            updateClinicalVariants(variant.clinvar_id, updatedVariants);
            showComparison(updatedVariants);
        } catch (error) {
            updateClinicalVariants(variant.clinvar_id, {
                ...variant,
                isAnalyzing: false,
                evo2Error: error instanceof Error ? error.message : "Analysis Failed"
            });
        }
    }
    return (
        <Card className='border-none gap-0 bg-white py-0 shadow-sm'>
            <CardHeader className='flex flex-row items-center justify-between pt-4 pb-2'>
                <CardTitle className='text-normal font-sm text-[#3c4f3d]/70'>Known Variants in gene from Clinical Variants</CardTitle>
                <Button variant="ghost" size="sm" onClick={refreshVariants} disabled={isLoadingClinVar} className='h-7 cursor-pointer text-xs text-[#3c4f3d] hover:bg-[#e9eeea]/70'>
                <RefreshCcw className='mr-1 w-3 h-3'/>
                Refresh
                </Button>
            </CardHeader>
            <CardContent className='pb-4'>
                {clinvarError && (<div className='mb-4 rounded-md bg-red-50 p-3 text-xs text-red-600'>{clinvarError}</div>)}
                {isLoadingClinVar ? <div className='py-6 flex justify-center'><div className='w-5 h-5 animate-spin rounded-full border-2 border-[#3c4f3d]/30 border-t-[#3c4f3d]'></div></div> : clinicalVariants.length > 0 ? <div className='h-96 max-h-96 overflow-y-scroll  rounded-md border border-[#3c4f3d]/5 '>
                    <Table>
                        <TableHeader className='sticky top-0 z-10'>
                            <TableRow className='bg-[#e9eeea]/80 hover:bg-[#e9eeea]/30'>
                                <TableHead className='py-2 text-xs font-medium text-[#3c4f3d]'>Variant</TableHead>
                                <TableHead className='py-2 text-xs font-medium text-[#3c4f3d]'>Type</TableHead>
                                <TableHead className='py-2 text-xs font-medium text-[#3c4f3d]'>Clinical Significance</TableHead>
                                <TableHead className='py-2 text-xs font-medium text-[#3c4f3d]'>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>{clinicalVariants.map((variant) => (
                            <TableRow key={variant.clinvar_id} className='border-b border-[#3c4f3d]/5'>
                                <TableCell className='py-2'>
                                    <div className='text-xs font-medium text-[#3c4f3d]'>{variant.title}</div>
                                    <div className='mt-1 flex gap-1 text-xs items-center text-[#3c4f3d]/70'>
                                        <p>Location:{variant.location}</p>
                                        <Button variant="link" size="sm" className='h-6 cursor-pointer px-0 text-xs text-[#de8246] hover:text-[#de8246]/70' onClick={() => window.open(`https://www.ncbi.nlm.nih.gov/clinvar/variation/${variant.clinvar_id}`, "_blank",)}>
                                            View in Clinical Variant
                                            <ExternalLink className='mt-1 inline-block h-2 w-2' />
                                        </Button>
                                    </div>
                                </TableCell>
                                <TableCell className='text-xs py-2'>{variant.variation_type}</TableCell>
                                <TableCell className='text-xs py-2'>
                                    <div className={`w-fit rounded-md px-2 py-1 text-center font-normal ${getClassificationColorClasses(variant.classification)}`}>{variant.classification || "Unknown"}</div>
                                    {variant.evo2Result && (<div className='mt-2'>
                                        <div className={`flex w-fit items-center gap-1 rounded-md px-2 py-1 text-center ${getClassificationColorClasses(variant.evo2Result.prediction)}`}>
                                            <Shield className='h-3 w-3' />
                                            <span>Evo2:{variant.evo2Result.prediction}</span>
                                        </div>
                                    </div>)}
                                </TableCell>
                                <TableCell className='text-xs py-2'>
                                    <div className=' flex flex-col items-end gap-1'>
                                        {variant.variation_type.toLowerCase().includes("single nucleotide") ? (!variant.evo2Result ? <Button variant="outline" size="sm" className='h-7 cursor-pointer border-[#3c4f3d]/20 bg-[#e9eeea] px-3 text-xs text-[#3c4f3d] hover:bg-[#3c4f3d]/10' disabled={variant.isAnalyzing}
                                            onClick={() => analyzeVariant(variant)}
                                        >
                                            {variant.isAnalyzing ? <><span className='mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-[#3c4f3d]/30 border-t-[#3c4f3d]/30 '></span>Analyzing...</> : <><Zap className='mr-1 inline-block w-3 h-3' />Analayze with evo2</>}</Button> : <Button variant="outline" size="sm" className='h-7 cursor-pointer border-green-300 bg-green-50 px-3 text-xs text-green-700 hover:bg-green-100' onClick={()=>showComparison(variant)}>
                                            <BarChart2 className='mr-1 inline-block h-3 w-3' />
                                            Compare Results
                                        </Button>) : null}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}</TableBody>
                    </Table></div> : 
                    <div className='flex flex-col h-48 items-center justify-center text-gray-400 text-center'>
                        <Search className="mb-4 h-10 w-10 text-gray-300"/>
                        <p className='text-sm realding-relaxed'>No clinical Variants found for this gene</p>
                    </div>}
            </CardContent>
        </Card>
    )
}

export default KnownVariants