/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  FileUp, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileText, 
  ClipboardCheck,
  RotateCcw,
  Download,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';

// Constants
const MODEL_NAME = "gemini-3-flash-preview";

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [requirements, setRequirements] = useState<string>("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [unmetItems, setUnmetItems] = useState<string | null>(null);
  const [modifiedContent, setModifiedContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (event) => {
        setFileContent(event.target?.result as string);
      };
      reader.readAsText(selectedFile);
    }
  };

  const resetAll = () => {
    setFile(null);
    setFileContent("");
    setRequirements("");
    setUnmetItems(null);
    setModifiedContent(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const analyzeRequirements = async () => {
    if (!fileContent || !requirements) {
      setError("Please upload a file and enter requirements.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `
        You are a meticulous Compliance Officer and Data Editor. 
        I am providing you with a file's content and a set of requirements.
        
        ### FILE CONTENT:
        ${fileContent}
        
        ### REQUIREMENTS:
        ${requirements}
        
        ### TASK:
        1. **Extract Unmet Requirements**: Identify specific parts of the file content that do NOT meet the provided requirements. Be detailed and point out exactly what is missing or incorrect.
        2. **Modified Content**: Provide the FULL content of the file, modified to strictly adhere to all the requirements.
        
        ### RESPONSE FORMAT:
        Please respond strictly in the following format:
        
        ---UNMET_START---
        [List the unmet items here in Markdown format]
        ---UNMET_END---
        
        ---MODIFIED_START---
        [Provide the full modified content here]
        ---MODIFIED_END---
      `;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ parts: [{ text: prompt }] }],
      });

      const resultText = response.text || "";
      
      const unmetMatch = resultText.match(/---UNMET_START---([\s\S]*?)---UNMET_END---/);
      const modifiedMatch = resultText.match(/---MODIFIED_START---([\s\S]*?)---MODIFIED_END---/);

      if (unmetMatch && modifiedMatch) {
        setUnmetItems(unmetMatch[1].trim());
        setModifiedContent(modifiedMatch[1].trim());
      } else {
        // Fallback if formatting was slightly off
        setUnmetItems(resultText);
        setModifiedContent("Could not parse perfectly, please check the full response above.");
      }

    } catch (err) {
      console.error("AI Analysis failed:", err);
      setError("Analysis failed. Please check your API key or try again later.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const downloadModified = () => {
    if (!modifiedContent) return;
    const blob = new Blob([modifiedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `modified_${file?.name || 'file.txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen bg-[#0a0a0a] text-gray-200 font-sans flex flex-col overflow-hidden selection:bg-blue-500/30">
      {/* Top Navigation Bar */}
      <nav className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-[#0f0f0f] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white text-lg overflow-hidden relative group">
            <ClipboardCheck className="w-5 h-5" />
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center">
            ReqFlow <span className="text-blue-500 text-[10px] font-mono tracking-wider ml-3 border border-blue-500/30 px-1.5 py-0.5 rounded leading-none">v1.2</span>
          </h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-gray-500 font-bold uppercase tracking-widest hidden sm:block">
            Status: {isAnalyzing ? "Analyzing..." : "Ready"}
          </div>
          <button 
            onClick={resetAll}
            className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-500 hover:text-white"
            title="초기화"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Main Content Grid */}
      <main className="flex-1 grid grid-cols-12 gap-0 overflow-hidden bg-[#0a0a0a]">
        
        {/* Left Panel: File Selection */}
        <section className="col-span-12 lg:col-span-3 border-r border-white/10 bg-[#0f0f0f] p-5 flex flex-col gap-6 overflow-y-auto">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3 block italic">01. 파일 업로드</label>
            <div 
              className={cn(
                "border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer bg-white/[0.02] flex flex-col items-center justify-center min-h-[160px]",
                file ? "border-blue-500/50 bg-blue-500/[0.03]" : "border-white/10 hover:border-blue-500/30 hover:bg-white/[0.04]"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                className="hidden"
              />
              {file ? (
                <div className="flex flex-col items-center">
                  <div className="w-10 h-10 bg-blue-500/20 rounded flex items-center justify-center mb-3">
                    <FileText className="w-5 h-5 text-blue-400" />
                  </div>
                  <p className="text-xs font-medium text-gray-200 truncate max-w-full italic">{file.name}</p>
                  <p className="text-[10px] text-gray-500 mt-1 uppercase">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <>
                  <FileUp className="w-8 h-8 mb-3 text-gray-600" />
                  <p className="text-xs text-gray-500 font-medium">Drop or select source file</p>
                </>
              )}
            </div>
            
            {file && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                  setFileContent("");
                }}
                className="w-full mt-3 py-2 text-[10px] uppercase font-bold tracking-widest text-red-500/70 hover:text-red-500 hover:bg-red-500/5 rounded transition-all"
              >
                파일 제거
              </button>
            )}
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3 block italic">02. 가공 유형</label>
            <div className="flex flex-wrap gap-2">
              <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-gray-400">명세서 검증</span>
              <span className="px-2 py-1 bg-blue-500/10 border border-blue-500/30 rounded text-[10px] text-blue-400 font-bold">자동 보정</span>
              <span className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] text-gray-400 italic">형식 변환</span>
            </div>
          </div>
          
          <div className="mt-auto pt-6 border-t border-white/5">
            <p className="text-[10px] text-gray-600 font-mono uppercase tracking-tighter">AI ENGINE: {MODEL_NAME}</p>
          </div>
        </section>

        {/* Center Panel: Requirements Input */}
        <section className="col-span-12 lg:col-span-5 border-r border-white/10 p-5 flex flex-col bg-[#0a0a0a]">
          <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3 block italic">03. 요구 사항 입력</label>
          <div className="flex-1 bg-[#141414] border border-white/10 rounded-xl overflow-hidden flex flex-col group focus-within:border-blue-500/50 transition-colors">
            <div className="h-8 bg-[#1a1a1a] border-b border-white/5 px-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500/20" />
              <div className="w-2 h-2 rounded-full bg-yellow-500/20" />
              <div className="w-2 h-2 rounded-full bg-green-500/20" />
              <span className="text-[10px] text-gray-600 ml-2 font-mono uppercase tracking-widest">requirements_editor.md</span>
            </div>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="여기에 요구사항을 입력하세요...&#10;예: 모든 통화는 USD로 표시한다.&#10;폰트 사이즈는 최소 12px 이상이어야 한다."
              className="flex-1 bg-transparent p-6 text-sm font-mono leading-relaxed resize-none focus:outline-none text-gray-300 placeholder:text-gray-700"
            />
          </div>
          
          {/* Action Area Below Textarea */}
          <div className="mt-4 flex items-center justify-between">
            {error ? (
              <p className="text-red-500 text-[10px] font-bold uppercase italic">{error}</p>
            ) : (
              <p className="text-[10px] text-gray-600 font-mono">CHARS: {requirements.length}</p>
            )}
            <button
              onClick={analyzeRequirements}
              disabled={isAnalyzing}
              className={cn(
                "px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:grayscale disabled:opacity-50",
                isAnalyzing && "cursor-wait"
              )}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="uppercase tracking-widest text-[10px]">Processing</span>
                </>
              ) : (
                <>
                  <span>준수 여부 검사 및 수정</span>
                  <CheckCircle2 className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </section>

        {/* Right Panel: Extraction & Results */}
        <section className="col-span-12 lg:col-span-4 p-5 flex flex-col bg-[#0f0f0f] overflow-hidden">
          <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3 block italic">04. 결과 분석 및 미반영 항목</label>
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            <AnimatePresence mode="wait">
              {!unmetItems && !modifiedContent ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-center opacity-30 select-none grayscale"
                >
                  <AlertCircle className="w-12 h-12 mb-4 text-gray-400" />
                  <p className="text-sm font-mono uppercase tracking-widest">Waiting for analysis</p>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                  {/* Unmet Items List */}
                  <div className="space-y-3">
                    <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl relative overflow-hidden group">
                      <div className="flex justify-between mb-2">
                        <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">미반영 항목</span>
                        <AlertTriangle className="w-3 h-3 text-red-500/50" />
                      </div>
                      <div className="markdown-body prose-invert prose-red">
                        <ReactMarkdown>{unmetItems || ""}</ReactMarkdown>
                      </div>
                    </div>
                  </div>

                  {/* Corrected Content Preview */}
                  <div className="space-y-3">
                    <div className="p-4 bg-white/[0.03] border border-white/10 rounded-xl">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">수정된 결과물</span>
                        <button 
                          onClick={downloadModified}
                          className="p-1.5 hover:bg-white/10 rounded transition-colors text-blue-400"
                          title="다운로드"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto rounded bg-black/40 p-3 border border-white/5">
                        <pre className="text-[11px] font-mono text-gray-400 leading-relaxed whitespace-pre-wrap">
                          {modifiedContent}
                        </pre>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* Decorative footer */}
      <div className="h-2 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 shrink-0" />
    </div>
  );
}
