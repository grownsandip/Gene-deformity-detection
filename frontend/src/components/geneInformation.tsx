"use cilent";
import React from 'react'
import type { GeneBoundsType, GeneDetailsType, GeneType } from '~/utils/genome-api'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ExternalLink} from 'lucide-react';

const GeneInformation = ({ gene, geneDetails, geneBounds }: { gene: GeneType; geneDetails: GeneDetailsType | null; geneBounds: GeneBoundsType | null; }) => {
    return (
        <Card className='gap-0 border-none bg-white py-0 shadow-sm'>
            <CardHeader className='pt-4 pb-2'>
                <CardTitle className='text-sm font-normal text-[#3c4f3d]/70'>
                    gene information
                </CardTitle>
            </CardHeader>
            <CardContent className='pb-4'>
                <div className='grid gap-4 md:grid-cols-2'>
                    <div className='space-y-2'>
                        <div className='flex'>
                            <span className='w-28 min-28 text-xs text-[#3c4f3d]/70'>Symbol:</span>
                            <span className='text-xs font-medium'>{gene.symbol}</span>
                        </div>
                        <div className='flex'>
                            <span className='w-28 min-28 text-xs text-[#3c4f3d]/70'>Name:</span>
                            <span className='text-xs font-medium'>{gene.name}</span>
                        </div>
                        {gene.description && gene.description !== gene.name && (
                            <div className='flex'>
                                <span className='w-28 min-28 text-xs text-[#3c4f3d]/70'>Description:</span>
                                <span className='text-xs font-medium'>{gene.description}</span>
                            </div>
                        )}
                        <div className='flex'>
                            <span className='w-28 min-28 text-xs text-[#3c4f3d]/70'>Chromosome:</span>
                            <span className='text-xs font-medium'>{gene.chrom}</span>
                        </div>
                        {geneBounds && (
                            <div className='flex'>
                                <span className='w-28 min-28 text-xs text-[#3c4f3d]/70'>Position:</span>
                                <span className='text-xs font-medium'>
                                    {Math.min(geneBounds.min, geneBounds.max).toLocaleString()}-{" "}
                                    {Math.max(geneBounds.min, geneBounds.max).toLocaleString()}
                                    ({Math.abs(geneBounds.max - geneBounds.min+1).toLocaleString()} bp)
                                    {geneDetails?.genomicinfo?.[0]?.strand==="-" && "(reverse)"}
                                  </span>
                            </div>
                        )}
                    </div>
                    <div className='space-y-2'>
                        {gene.gene_id && (
                            <div className='flex'>
                                <span className='min-28 w-28 text-xs text-[#3c4f3d]/70'>Gene ID:</span>
                                <span className='text-xs'>
                                    <a href={`https://www.ncbi.nlm.nih.gov/gene/${gene.gene_id}`} target='_blank' className='text-blue-600 hover:underline flex items-center'>{gene.gene_id}<ExternalLink className='ml-1 inline-block h-3 w-3'/></a>
                                </span>
                            </div>
                        )}
                        {
                            geneDetails?.organism && (
                                <div className='flex'>
                                    <span className='w-28 text-xs text-[#3c4f3d]/70'>Organism:</span>
                                    <span className='text-xs'>{geneDetails.organism.scientificname}{geneDetails.organism.commonname &&  `(${geneDetails.organism.commonname })`}</span>
                                </div>
                            )
                        }
                        {geneDetails && (<div className='mt-4'>
                           <h3 className='mb-2 text-xs font-medium text-[#3c4f3d]/70'>Summary:</h3>
                           <p className='text-xs leading-relaxed text-[#3c4f3d]/80'>{geneDetails.summary}</p>
                        </div>)}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export default GeneInformation
