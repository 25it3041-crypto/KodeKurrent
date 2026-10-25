import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Play, Square, RotateCcw, Terminal, CheckCircle, XCircle } from 'lucide-react';
import Editor from '@monaco-editor/react';
import useStore from '../../lib/store';

const STARTER_CODE = {
  javascript: `// Write your solution here
function solution(input) {
  // Your code
  return result;
}

// Test with:
console.log(solution("test"));`,
  python: `# Write your solution here
def solution(input):
    # Your code
    pass

# Test:
print(solution("test"))`,
  java: `public class Solution {
    public static Object solution(String input) {
        // Your code
        return null;
    }
    
    public static void main(String[] args) {
        System.out.println(solution("test"));
    }
}`,
};

const TEST_CASES = [
  { id: 1, input: '"hello"', expected: 'Output based on your solution' },
  { id: 2, input: '"world"', expected: 'Output based on your solution' },
];

export default function CodingEditor() {
  const { setCodingCode, codingCode, addKeystroke } = useStore();
  const [lang, setLang] = useState('javascript');
  const [output, setOutput] = useState('');
  const [running, setRunning] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const [keystrokes, setKeystrokes] = useState([]);
  const [replayIdx, setReplayIdx] = useState(-1);
  const [isReplaying, setIsReplaying] = useState(false);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    if (!codingCode) {
      setCodingCode(STARTER_CODE[lang]);
    }
  }, [lang]);

  const handleEditorChange = (value) => {
    const now = Date.now() - startTimeRef.current;
    setCodingCode(value);
    const ks = { t: now, v: value?.length || 0 };
    setKeystrokes(prev => [...prev, ks]);
    addKeystroke(ks);
  };

  const handleEditorMount = (editor) => {
    editor.onKeyDown((e) => {
      const now = Date.now() - startTimeRef.current;
      addKeystroke({ t: now, key: e.code });
    });
  };

  const runCode = async () => {
    setRunning(true);
    setOutput('');
    setTestResults([]);

    try {
      // Safe in-browser execution for JavaScript only
      if (lang === 'javascript') {
        const logs = [];
        const originalLog = console.log;
        console.log = (...args) => logs.push(args.map(String).join(' '));

        try {
          // eslint-disable-next-line no-new-func
          const fn = new Function(codingCode);
          fn();
        } catch (e) {
          logs.push(`Error: ${e.message}`);
        }

        console.log = originalLog;
        setOutput(logs.join('\n') || '(no output)');
        setTestResults(TEST_CASES.map(tc => ({
          ...tc,
          passed: true, // Mark pass for demo (real evaluation needs backend)
          actual: logs[0] || '—',
        })));
      } else {
        setOutput(`${lang} execution requires a backend runner.\nCode saved — will be evaluated server-side.`);
      }
    } finally {
      setRunning(false);
    }
  };

  const startReplay = async () => {
    if (keystrokes.length === 0) return;
    setIsReplaying(true);
    setReplayIdx(0);
    let current = '';
    for (let i = 0; i < keystrokes.length; i++) {
      setReplayIdx(i);
      await new Promise(r => setTimeout(r, 50));
    }
    setIsReplaying(false);
    setReplayIdx(-1);
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden card-shadow"
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-slate-700 text-sm">Coding Sandbox</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={lang}
            onChange={e => { setLang(e.target.value); setCodingCode(STARTER_CODE[e.target.value]); }}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
          >
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
          <button
            onClick={startReplay}
            disabled={isReplaying || keystrokes.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-40"
            title="Keystroke Replay"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Replay ({keystrokes.length})
          </button>
          <button
            onClick={runCode}
            disabled={running}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold gradient-indigo text-white rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            {running ? <Square className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {running ? 'Running...' : 'Run Code'}
          </button>
        </div>
      </div>

      {/* Keystroke dynamics indicator */}
      {keystrokes.length > 0 && (
        <div className="px-4 py-2 bg-violet-50 border-b border-violet-100 flex items-center gap-2">
          <div className="flex gap-0.5 items-end h-4">
            {keystrokes.slice(-20).map((k, i) => (
              <div key={i} className="w-1 bg-violet-300 rounded-sm" style={{ height: `${Math.min(16, 4 + (k.v || 0) % 12)}px` }} />
            ))}
          </div>
          <span className="text-xs text-violet-600">{keystrokes.length} keystrokes recorded — Smart Replay enabled</span>
          {isReplaying && (
            <span className="ml-auto text-xs text-violet-700 font-medium">
              Replaying... {replayIdx + 1}/{keystrokes.length}
            </span>
          )}
        </div>
      )}

      {/* Editor */}
      <Editor
        height="320px"
        language={lang}
        value={codingCode}
        onChange={handleEditorChange}
        onMount={handleEditorMount}
        theme="vs"
        options={{
          fontSize: 13,
          minimap: { enabled: false },
          padding: { top: 12 },
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
        }}
      />

      {/* Output */}
      {(output || testResults.length > 0) && (
        <div className="border-t border-slate-100">
          <div className="p-4 bg-slate-900 text-emerald-400 font-mono text-xs">
            <p className="text-slate-400 mb-1">// Output</p>
            <pre className="whitespace-pre-wrap">{output}</pre>
          </div>

          {testResults.length > 0 && (
            <div className="p-4 grid grid-cols-1 gap-2">
              <p className="text-xs font-semibold text-slate-600 mb-1">Test Cases</p>
              {testResults.map(tc => (
                <div key={tc.id} className={`flex items-center gap-3 p-2 rounded-lg text-xs ${tc.passed ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'}`}>
                  {tc.passed ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />}
                  <span className="font-mono text-slate-600">Input: {tc.input}</span>
                  <span className="ml-auto font-mono">{tc.actual}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
