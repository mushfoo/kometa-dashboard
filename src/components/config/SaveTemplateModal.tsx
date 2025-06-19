'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { X, Save, FileText, Tag, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TemplateService, type ConfigTemplate } from '@/lib/TemplateService';

interface SaveTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  yamlContent: string;
  // eslint-disable-next-line no-unused-vars
  onSave?: (template: ConfigTemplate) => void;
}

export function SaveTemplateModal({
  isOpen,
  onClose,
  yamlContent,
  onSave,
}: SaveTemplateModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templateService = new TemplateService();

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    if (!description.trim()) {
      setError('Template description is required');
      return;
    }

    if (!yamlContent.trim()) {
      setError('No configuration content to save');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Validate the YAML content
      const validation = await templateService.validateTemplate(yamlContent);
      if (!validation.valid) {
        setError(`Invalid YAML configuration: ${validation.errors.join(', ')}`);
        return;
      }

      // Generate preview data
      const preview = templateService.generatePreview(yamlContent);

      // Save the template
      const template = await templateService.saveCustomTemplate({
        name: name.trim(),
        description: description.trim(),
        category: 'custom',
        tags,
        version: '1.0.0',
        yaml: yamlContent,
        ...(preview && { preview }),
      });

      onSave?.(template);
      onClose();

      // Reset form
      setName('');
      setDescription('');
      setTags([]);
      setTagInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setTags([]);
    setTagInput('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-semibold">Save as Template</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-6">
            <div>
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                placeholder="My Custom Configuration"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={cn(error && !name.trim() && 'border-red-500')}
              />
            </div>

            <div>
              <Label htmlFor="template-description">Description *</Label>
              <Textarea
                id="template-description"
                placeholder="Describe what this template does and when to use it..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className={cn(error && !description.trim() && 'border-red-500')}
              />
            </div>

            <div>
              <Label htmlFor="template-tags">Tags</Label>
              <div className="space-y-2">
                <Input
                  id="template-tags"
                  placeholder="Add tags (press Enter or comma to add)"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleAddTag}
                />
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-sm bg-secondary px-2 py-1 rounded cursor-pointer hover:bg-secondary/80"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        <Tag className="h-3 w-3" />
                        {tag}
                        <X className="h-3 w-3 hover:text-red-500" />
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Tags help categorize and find templates later
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">Configuration Preview</h4>
              <div className="text-sm text-muted-foreground space-y-1">
                {(() => {
                  const preview = templateService.generatePreview(yamlContent);
                  return (
                    <>
                      {preview.collections && (
                        <div>
                          📁 {preview.collections} collections will be created
                        </div>
                      )}
                      {preview.libraries && preview.libraries.length > 0 && (
                        <div>📚 Libraries: {preview.libraries.join(', ')}</div>
                      )}
                      {preview.features && preview.features.length > 0 && (
                        <div>⚡ Features: {preview.features.join(', ')}</div>
                      )}
                      <div>
                        📄 {yamlContent.split('\n').length} lines of
                        configuration
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert>
              <FileText className="h-4 w-4" />
              <AlertDescription>
                Your template will be saved locally and can be reused in future
                configurations. Templates are stored in your browser&apos;s
                local storage.
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || !name.trim() || !description.trim()}
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
