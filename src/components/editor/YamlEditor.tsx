'use client';

import { useRef, useState } from 'react';
import Editor, { OnMount, OnChange } from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  Download,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* eslint-disable no-unused-vars */
interface YamlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (valid: boolean, errors: string[]) => void;
  height?: string;
  readOnly?: boolean;
  theme?: 'light' | 'dark';
  className?: string;
  showToolbar?: boolean;
  hasChanges?: boolean;
  changedLines?: number[];
  originalValue?: string;
}
/* eslint-enable no-unused-vars */

export function YamlEditor({
  value,
  onChange,
  onValidationChange,
  height = '400px',
  readOnly = false,
  theme = 'light',
  className,
  showToolbar = true,
  hasChanges = false,
  changedLines = [],
  originalValue = '',
}: YamlEditorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValid, setIsValid] = useState(true);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setIsLoading(false);

    // Configure YAML language
    monaco.languages.setLanguageConfiguration('yaml', {
      wordPattern:
        /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
      comments: {
        lineComment: '#',
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
      surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
      folding: {
        offSide: true,
      },
    });

    // Set up validation
    validateYaml(value);

    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      // Save shortcut (could trigger a save callback)
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      editor.getAction('actions.find')?.run();
    });

    // Apply initial change highlighting
    applyChangeHighlighting(editor, monaco);
  };

  const applyChangeHighlighting = (editor: any, monaco: any) => {
    if (!hasChanges || !originalValue || changedLines.length === 0) return;

    const decorations = changedLines.map((lineNumber) => ({
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {
        isWholeLine: true,
        className: 'yaml-changed-line',
        glyphMarginClassName: 'yaml-changed-glyph',
        minimap: {
          color: '#fbbf24',
          position: 1,
        },
        overviewRuler: {
          color: '#fbbf24',
          position: 1,
        },
      },
    }));

    editor.deltaDecorations([], decorations);

    // Add CSS for highlighting
    const style = document.createElement('style');
    style.textContent = `
      .yaml-changed-line {
        background-color: rgba(251, 191, 36, 0.1) !important;
        border-left: 3px solid #fbbf24 !important;
      }
      .yaml-changed-glyph {
        background-color: #fbbf24 !important;
        width: 3px !important;
        margin-left: 3px !important;
      }
      .monaco-editor.vs-dark .yaml-changed-line {
        background-color: rgba(251, 191, 36, 0.15) !important;
      }
    `;
    document.head.appendChild(style);
  };

  const handleEditorChange: OnChange = (newValue) => {
    const yamlValue = newValue || '';
    onChange(yamlValue);
    validateYaml(yamlValue);
  };

  const validateYaml = async (yamlContent: string) => {
    if (!yamlContent.trim()) {
      setValidationErrors([]);
      setIsValid(true);
      onValidationChange?.(true, []);
      return;
    }

    try {
      // Use dynamic import to avoid SSR issues
      const yaml = await import('yaml');
      yaml.parse(yamlContent);
      setValidationErrors([]);
      setIsValid(true);
      onValidationChange?.(true, []);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Invalid YAML';
      setValidationErrors([errorMessage]);
      setIsValid(false);
      onValidationChange?.(false, [errorMessage]);
    }
  };

  const formatDocument = () => {
    if (editorRef.current) {
      editorRef.current.getAction('editor.action.formatDocument')?.run();
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const downloadYaml = () => {
    const blob = new Blob([value], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.yml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onChange(content);
      };
      reader.readAsText(file);
    }
    // Reset input
    event.target.value = '';
  };

  return (
    <div className={cn('space-y-4', className)}>
      {showToolbar && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              {isValid ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                {isValid ? 'Valid YAML' : 'Invalid YAML'}
              </span>
            </div>

            {hasChanges && (
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                <span className="text-sm font-medium">
                  {changedLines.length > 0
                    ? `${changedLines.length} lines changed`
                    : 'Modified'}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={formatDocument}
              disabled={isLoading || readOnly}
            >
              Format
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              disabled={isLoading}
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadYaml}
              disabled={isLoading}
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => document.getElementById('yaml-upload')?.click()}
              disabled={isLoading || readOnly}
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </Button>
            <input
              id="yaml-upload"
              type="file"
              accept=".yml,.yaml"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
      )}

      {validationErrors.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">YAML Validation Errors:</p>
              {validationErrors.map((error, index) => (
                <p key={index} className="text-sm">
                  {error}
                </p>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card className="relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        <Editor
          height={height}
          defaultLanguage="yaml"
          value={value}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          theme={theme === 'dark' ? 'vs-dark' : 'vs'}
          options={{
            readOnly,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 14,
            lineNumbers: 'on',
            glyphMargin: false,
            folding: true,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 3,
            renderLineHighlight: 'line',
            scrollbar: {
              vertical: 'visible',
              horizontal: 'visible',
              useShadows: false,
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            },
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            detectIndentation: false,
            bracketPairColorization: {
              enabled: true,
            },
            suggest: {
              showKeywords: true,
              showSnippets: true,
            },
            quickSuggestions: {
              other: true,
              comments: false,
              strings: true,
            },
          }}
        />
      </Card>
    </div>
  );
}
