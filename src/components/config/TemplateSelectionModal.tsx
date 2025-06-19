'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Search,
  Download,
  Star,
  Tag,
  Calendar,
  User,
  Info,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  TemplateService,
  type ConfigTemplate,
  type TemplateCategory,
} from '@/lib/TemplateService';

interface TemplateSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (
    // eslint-disable-next-line no-unused-vars
    template: ConfigTemplate,
    // eslint-disable-next-line no-unused-vars
    customizations?: Record<string, any>
  ) => void;
}

export function TemplateSelectionModal({
  isOpen,
  onClose,
  onSelectTemplate,
}: TemplateSelectionModalProps) {
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ConfigTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('basic');
  const [customizations, setCustomizations] = useState<Record<string, string>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const templateService = useMemo(() => new TemplateService(), []);

  const loadTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const templateCategories = await templateService.getAllTemplates();
      setCategories(templateCategories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }, [templateService]);

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen, loadTemplates]);

  const filteredTemplates =
    categories
      .find((cat) => cat.id === selectedCategory)
      ?.templates?.filter(
        (template) =>
          template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          template.description
            .toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          template.tags.some((tag) =>
            tag.toLowerCase().includes(searchQuery.toLowerCase())
          )
      ) || [];

  const handleTemplateSelect = (template: ConfigTemplate) => {
    setSelectedTemplate(template);
    // Pre-populate common customization fields
    setCustomizations({
      'plex.url': '',
      'plex.token': '',
      'tmdb.apikey': '',
      'trakt.client_id': '',
    });
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      // Filter out empty customizations
      const validCustomizations = Object.fromEntries(
        Object.entries(customizations).filter(
          ([, value]) => value.trim() !== ''
        )
      );

      onSelectTemplate(selectedTemplate, validCustomizations);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply template');
    }
  };

  const handleCustomizationChange = (key: string, value: string) => {
    setCustomizations((prev) => ({ ...prev, [key]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex h-full max-h-[90vh]">
          {/* Left Panel - Template Selection */}
          <div className="w-2/3 border-r flex flex-col">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    Select Configuration Template
                  </h2>
                  <p className="text-muted-foreground">
                    Choose a pre-built configuration to get started quickly
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <Tabs
                value={selectedCategory}
                onValueChange={setSelectedCategory}
                className="h-full flex flex-col"
              >
                <TabsList className="grid w-full grid-cols-3 m-4 mb-0">
                  {categories.map((category) => (
                    <TabsTrigger key={category.id} value={category.id}>
                      {category.name}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {categories.map((category) => (
                  <TabsContent
                    key={category.id}
                    value={category.id}
                    className="flex-1 overflow-auto p-4 pt-2 m-0"
                  >
                    <div className="space-y-3">
                      {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">
                          Loading templates...
                        </div>
                      ) : filteredTemplates.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          {searchQuery
                            ? 'No templates match your search'
                            : 'No templates available'}
                        </div>
                      ) : (
                        filteredTemplates.map((template) => (
                          <Card
                            key={template.id}
                            className={cn(
                              'p-4 cursor-pointer transition-all hover:shadow-md',
                              selectedTemplate?.id === template.id
                                ? 'ring-2 ring-primary bg-primary/5'
                                : 'hover:border-primary/50'
                            )}
                            onClick={() => handleTemplateSelect(template)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <FileText className="h-4 w-4 text-primary" />
                                  <h3 className="font-medium">
                                    {template.name}
                                  </h3>
                                  <span className="text-xs bg-muted px-2 py-1 rounded">
                                    v{template.version}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-3">
                                  {template.description}
                                </p>

                                <div className="flex flex-wrap gap-1 mb-2">
                                  {template.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="inline-flex items-center gap-1 text-xs bg-secondary px-2 py-1 rounded"
                                    >
                                      <Tag className="h-3 w-3" />
                                      {tag}
                                    </span>
                                  ))}
                                </div>

                                {template.preview && (
                                  <div className="text-xs text-muted-foreground space-y-1">
                                    {template.preview.collections && (
                                      <div>
                                        📁 {template.preview.collections}{' '}
                                        collections
                                      </div>
                                    )}
                                    {template.preview.libraries &&
                                      template.preview.libraries.length > 0 && (
                                        <div>
                                          📚 Libraries:{' '}
                                          {template.preview.libraries.join(
                                            ', '
                                          )}
                                        </div>
                                      )}
                                    {template.preview.features &&
                                      template.preview.features.length > 0 && (
                                        <div>
                                          ⚡ Features:{' '}
                                          {template.preview.features.join(', ')}
                                        </div>
                                      )}
                                  </div>
                                )}
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </Card>
                        ))
                      )}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </div>

          {/* Right Panel - Preview and Customization */}
          <div className="w-1/3 flex flex-col">
            {selectedTemplate ? (
              <>
                <div className="p-6 border-b">
                  <h3 className="text-lg font-semibold mb-2">
                    {selectedTemplate.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {selectedTemplate.description}
                  </p>

                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3" />
                      <span>{selectedTemplate.author || 'Kometa Team'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3" />
                      <span>
                        Updated{' '}
                        {new Date(
                          selectedTemplate.updated
                        ).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="h-3 w-3" />
                      <span>Version {selectedTemplate.version}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-6">
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-medium mb-3">Customize Template</h4>
                      <div className="space-y-3">
                        <div>
                          <Label htmlFor="plex-url" className="text-sm">
                            Plex Server URL
                          </Label>
                          <Input
                            id="plex-url"
                            placeholder="http://localhost:32400"
                            value={customizations['plex.url'] || ''}
                            onChange={(e) =>
                              handleCustomizationChange(
                                'plex.url',
                                e.target.value
                              )
                            }
                          />
                        </div>

                        <div>
                          <Label htmlFor="plex-token" className="text-sm">
                            Plex Token
                          </Label>
                          <Input
                            id="plex-token"
                            type="password"
                            placeholder="Your Plex token"
                            value={customizations['plex.token'] || ''}
                            onChange={(e) =>
                              handleCustomizationChange(
                                'plex.token',
                                e.target.value
                              )
                            }
                          />
                        </div>

                        {selectedTemplate.yaml.includes('tmdb') && (
                          <div>
                            <Label htmlFor="tmdb-key" className="text-sm">
                              TMDB API Key
                            </Label>
                            <Input
                              id="tmdb-key"
                              type="password"
                              placeholder="Your TMDB API key"
                              value={customizations['tmdb.apikey'] || ''}
                              onChange={(e) =>
                                handleCustomizationChange(
                                  'tmdb.apikey',
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        )}

                        {selectedTemplate.yaml.includes('trakt') && (
                          <div>
                            <Label htmlFor="trakt-id" className="text-sm">
                              Trakt Client ID
                            </Label>
                            <Input
                              id="trakt-id"
                              placeholder="Your Trakt client ID"
                              value={customizations['trakt.client_id'] || ''}
                              onChange={(e) =>
                                handleCustomizationChange(
                                  'trakt.client_id',
                                  e.target.value
                                )
                              }
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        You can modify these values after applying the template.
                        Leave fields empty to use placeholder values.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>

                <div className="p-6 border-t">
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedTemplate(null)}
                    >
                      Back
                    </Button>
                    <Button onClick={handleApplyTemplate} className="flex-1">
                      <Download className="h-4 w-4 mr-2" />
                      Apply Template
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-6">
                <div className="space-y-2">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
                  <h3 className="font-medium">Select a Template</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose a template from the left to see details and
                    customization options.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="m-6 mt-0">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </Card>
    </div>
  );
}
