"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Input } from "~/components/ui/input";
import { type ChrormosomeType, type GeneType, type GenomeAssemblyType, getAvailableGenomes, getGenomeChromosomes, searchGenes } from "~/utils/genome-api";
import { Button } from "~/components/ui/button";
import { Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import GeneViewer from "~/components/geneViewer";

type Mode = "browse" | "search"

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [genomes, setGenomes] = useState<GenomeAssemblyType[]>([]);
  const [chromosomes, setChromosomes] = useState<ChrormosomeType[]>([]);
  const [selectedGenome, setSelectedGenome] = useState<string>("hg38");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGene,setSelectedGene]=useState<GeneType | null>(null)
  const [searchResults, setSearchResults] = useState<GeneType[]>([]);
  const [selectedChromosome, setSelectedChromosome] = useState<string>("chr1");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("search");
  useEffect(() => {
    const fetchGenomes = async () => {
      try {
        setIsLoading(true);
        const genomeData = await getAvailableGenomes();
        if (genomeData.genomes && genomeData.genomes["Human"]) {
          setGenomes(genomeData.genomes["Human"]);
        }
      } catch (error) {
        setError("Failed to load genome data.")
      }
      finally {
        setIsLoading(false);
      }
    }
    fetchGenomes()
  }, [])
  useEffect(() => {
    const fetchChromosomes = async () => {
      try {
        setIsLoading(true);
        const chromoData = await getGenomeChromosomes(selectedGenome);
        setChromosomes(chromoData.chromosomes)
        //console.log(chromoData.chromosomes)
        if (chromoData.chromosomes.length > 0) {
          setSelectedChromosome(chromoData.chromosomes[0]!.name)
        }
      } catch (error) {
        setError("Failed to load chromosome data.")
      }
      finally {
        setIsLoading(false);
      }
    }
    fetchChromosomes()
  }, [selectedGenome])
  const PerformGeneSearch = async (query: string, genome: string, filterFn?: (gene: GeneType) => boolean) => {
    try {
      setIsLoading(false);
      const data = await searchGenes(query, genome);
      // console.log(data)
      const results = filterFn ? data.result.filter(filterFn) : data.result;
      //console.log(results)
      setSearchResults(results);
    } catch (error) {
      console.log(error)
      setError("Failed to search genes");
    }
    finally {
      setIsLoading(false);
    }
  }
  useEffect(() => {
    if (!selectedChromosome || mode != "browse") return;
    PerformGeneSearch(selectedChromosome, selectedGenome, (gene: GeneType) => gene.chrom === selectedChromosome)
  }, [selectedChromosome, selectedGenome, mode])
  const handleGenomeChange = (value: string) => {
    setSelectedGenome(value)
    setSearchResults([]);
    setSelectedGene(null);
  }
  const SwitchMode = (newMode: Mode) => {
    if (newMode === mode) return;
    setSearchResults([]);
    setSelectedGene(null);
    setError(null);
    if (newMode === "browse" && selectedChromosome) {
      PerformGeneSearch(selectedChromosome, selectedGenome, (gene: GeneType) => gene.chrom === selectedChromosome)
    }
    setMode(newMode);
  }
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    PerformGeneSearch(searchQuery, selectedGenome);
  }
  const laodBRCA1example = () => {
    setMode("search");
    setSearchQuery("BRCA1");
    //handle search
    PerformGeneSearch("BRCA1", selectedGenome);
  }
  return (
    <div className="min-h-screen bg-[#e9eeea]">
      <header className="border-b border-[#3c4f3d]/10 bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <h1 className="text-xl tracking-wide font-light text-[#3c4f3d]">
                <span className="font-normal">EVOLUTION</span>
                <span className="text-[#de8246]">2</span>
              </h1>
              <div className="absolute -bottom-1 left-0 h-[2px] w-27 bg-[#de8246]"></div>
            </div>
            <span className="text-sm font-light text-[#3c4f3d]/83">Gene Variant Analysis</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        {selectedGene ? <GeneViewer gene={selectedGene} genomeId={selectedGenome} onClose={()=>setSelectedGene(null)}/>:<>
        <Card className="mb-6 gap-0 border-none bg-white py-0 shadow-sm">
          <CardHeader className="pt-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-normal text-[#3c4f3d]/70">Genome Assembly</CardTitle>
              <div className="text-xs text-[#3c4f3d]/60 ">Organisms:<span className="font-medium">Human</span></div>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <Select value={selectedGenome} onValueChange={handleGenomeChange} disabled={isLoading}>
              <SelectTrigger className="h-9 w-full border-[#3c4f3d]/10">
                <SelectValue placeholder="Select Genome Assembly" />
              </SelectTrigger>
              <SelectContent>
                {
                  genomes.map((genome) => (
                    <SelectItem key={genome.id} value={genome.id}>
                      {genome.id}-{genome.name}
                      {genome.active ? "(active)" : ""}
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
            {
              selectedGenome && (<p className="mt-2 text-xs text-">
                {
                  genomes.find((genome) => genome.id === selectedGenome)?.sourceName
                }
              </p>)
            }
          </CardContent>
        </Card>
        <Card className="mt-6 gap-0 border-none bg-white py-0 shadow-sm">
          <CardHeader className="pt-4 pb-2">
            <CardTitle className="text-sm font-normal text-[#3c4f3d]/70">
              Browse
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <Tabs value={mode} onValueChange={(value) => SwitchMode(value as Mode)}>
              <TabsList className="mb-4 bg-[#e9eeea]">
                <TabsTrigger value="search" className="data-[state=active]:bg-white data-[state=active]:text-[#3c4f3d]">
                  Search Genes
                </TabsTrigger>
                <TabsTrigger value="browse" className="data-[state=active]:bg-white data-[state=active]:text-[#3c4f3d]">
                  Browse Chromosomes
                </TabsTrigger>
              </TabsList>
              <TabsContent value="search" className="mt-0">
                <div className="space-y-4">
                  <form onSubmit={handleSearch} className="flex flex-col gap-3 sm:flex-grow">
                    <div className="relative flex-1">
                      <Input type="text" placeholder="Enter gene symbol or name" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-9 border-[#3c4f3d]/10 pr-10" />
                      <Button className="absolute top-0 right-0 h-full rounded-l-none bg-[rgb(60,79,61)] cursor-pointer text-white hover:bg-[#3c4f3d]/90 " disabled={isLoading || !searchQuery.trim()} size="icon" type="submit">
                        <Search className="h-4  w-4"/>
                          <span className="sr-only">Search</span>
                      </Button>
                    </div>
                  </form>
                  <Button variant="link" className="h-auto cursor-pointer p-0 text-[#de8246] hover:text-[#de8246]/80 " onClick={laodBRCA1example}>Try BRCA1 examples</Button>
                </div>
              </TabsContent>
              <TabsContent value="browse" className="mt-0">
                <div className="max-h-[150px] overflow-y-auto pr-1">
                  <div className="flex flex-wrap gap-2">
                    {
                      chromosomes.map((chrom) => (
                        <Button key={chrom.name} variant="outline" size="sm" className={`cursor-pointer h-8 border-[#3c4f3d]/10 hover:bg-[#e9eeea] hover:text-[#3c4f3d] ${selectedChromosome === chrom.name ? "bg-[#e9eeea] text-[#3c4f3d]" : ""}`} onClick={() => setSelectedChromosome(chrom.name)}>{chrom.name}</Button>
                      ))
                    }
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            {isLoading && (<div className="flex justify-center py-4">
              <div className="h-6 w-6  animate-spin rounded-full border-2 border-[#3c43d]/30 border-t-[#de8248]"></div>
            </div>)}
            {error && (<div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>)}
            {(searchResults.length > 0 && !isLoading) && <div className="mt-6">
              <div className="mb-2">
                <h4 className="text-xs font-normal text-[#3c4f3d]/70">{mode === "search" ? <>Search Results:{" "} <span className="font-medium text-[#3c4f3d]">{searchResults.length} genes</span></> : <>Genes on {selectedChromosome}:{" "} <span className="font-medium text-[#3c4f3d]">{searchResults.length} found</span></>}</h4>
              </div>
              <div className="overflow-hidden rounded-md border border-[#3c4f3d]/5">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#e9eeea]/50 hover:bg-[#e9eeea]/70">
                    <TableHead className="text-xs font-normal text-[#3c4f3d]/70">Symbol</TableHead>
                    <TableHead className="text-xs font-normal text-[#3c4f3d]/70">Name</TableHead>
                    <TableHead className="text-xs font-normal text-[#3c4f3d]/70">Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((gene,index)=>(
                    <TableRow key={`${gene.symbol}-${index}`} className="cursor-pointer border-b border-[#3c4f3d]/5 hover:bg-[#e9eeea]/50" onClick={()=>setSelectedGene(gene)}>
                      <TableCell className="py-2 font-medium text-[#3c4f3d]">
                        {gene.symbol}
                      </TableCell>
                      <TableCell className="py-2 font-medium text-[#3c4f3d]">
                        {gene.name}
                      </TableCell>
                      <TableCell className="py-2 font-medium text-[#3c4f3d]">
                        {gene.chrom}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>}
            {!isLoading && !error && searchResults.length===0 && (
            <div className="flex h-48 flex-col items-center justify-center text-center text-gray-400">
            <Search className="mb-4 h-10 w-10 text-gray-300"/>
            <p className="text-sm leading-relaxed">{mode==="search"?"Enter a gene or symbol and click search":selectedChromosome?"No genes found on this chromosome":"Select a chromosome to view gene"}</p>
            </div>
            )}
          </CardContent>
        </Card></>}
      </main>
    </div>
  );
}
