import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Paper,
  LinearProgress,
  Divider,
  SelectChangeEvent
} from '@mui/material';
import { styled } from '@mui/material/styles';
import DownloadIcon from '@mui/icons-material/Download';
import { ResearchMode, ResearchType, researchApi } from '../services/api';
import { RootState } from '../store/store';
import { setError, setMode, setResearchTarget, setSections, setTitle, setType } from '../store/slices/researchSlice';
import { ResearchSection } from '../types/research';
import { downloadMarkdown } from '../utils/download';
import { downloadDocx } from '../utils/downloadDocx';

const drawerWidth = 240;

const Main = styled('main')<{}>(() => ({
  flexGrow: 1,
  padding: 0,
  marginLeft: `${drawerWidth}px`,
  width: `calc(100vw - ${drawerWidth}px)`,
  boxSizing: 'border-box',
  height: '100vh',
  overflowY: 'auto',
  backgroundColor: '#f5f5f5'
}));

const ResearchPage: React.FC = () => {
  const dispatch = useDispatch();
  const research = useSelector((state: RootState) => state.research);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);
  const [progressState, setProgressState] = useState({ progress: 0, message: '' });

  const handleModeChange = (event: SelectChangeEvent<ResearchMode>) => {
    dispatch(setMode(event.target.value as ResearchMode));
  };

  const handleTypeChange = (event: SelectChangeEvent<ResearchType>) => {
    dispatch(setType(event.target.value as ResearchType));
  };

  const handleTitleGeneration = async () => {
    if (!research.researchTarget) return;

    setIsGeneratingTitle(true);
    setProgressState({
      progress: 0,
      message: 'Generating title...',
    });

    try {
      const title = await researchApi.generateTitle(research.researchTarget);
      // Remove quotes from generated title
      const cleanTitle = title.replace(/^["']|["']$/g, '');
      dispatch(setTitle(cleanTitle));

      setProgressState({
        progress: 100,
        message: 'Title generated successfully!',
      });
    } catch (error) {
      console.error('Error generating title:', error);
      dispatch(setError('Failed to generate title. Please try again.'));
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const handleOutlineGeneration = async () => {
    if (!research.title) {
      dispatch(setError('Please generate a title first'));
      return;
    }

    setIsGeneratingOutline(true);
    setProgressState({
      progress: 0,
      message: 'Generating outline...',
    });

    try {
      console.log('Generating outline with:', {
        title: research.title,
        target: research.researchTarget,
        mode: research.mode,
        type: research.type
      });

      const outlineText = await researchApi.generateOutline(
        research.title,
        research.researchTarget,
        research.mode as ResearchMode,
        research.type as ResearchType
      );

      console.log('Generated outline text:', outlineText);

      // Parse outline into sections
      const sections: ResearchSection[] = [];
      let currentMainSection: ResearchSection | null = null;

      const lines = outlineText.split('\n').map(line => line.trim()).filter(line => line);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        console.log('Processing line:', line);

        // Check for main section (e.g., "1. Title")
        const mainSectionMatch = line.match(/^(\d+)\.\s+(.+?)(?:\s*\[|$)/);
        if (mainSectionMatch) {
          if (currentMainSection) {
            sections.push(currentMainSection);
          }
          currentMainSection = {
            number: mainSectionMatch[1],
            title: mainSectionMatch[2].trim(),
            content: '',
            subsections: []
          };

          // Look ahead for description in next line
          if (i + 1 < lines.length && lines[i + 1].startsWith('[')) {
            currentMainSection.content = lines[i + 1].slice(1, -1).trim();
            i++; // Skip next line since we processed it
          }
          continue;
        }

        // Check for subsection (e.g., "1.1 Title")
        const subSectionMatch = line.match(/^(\d+\.\d+)\s+(.+?)(?:\s*\[|$)/);
        if (subSectionMatch && currentMainSection) {
          const subsection = {
            number: subSectionMatch[1],
            title: subSectionMatch[2].trim(),
            content: ''
          };

          // Look ahead for description in next line
          if (i + 1 < lines.length && lines[i + 1].startsWith('[')) {
            subsection.content = lines[i + 1].slice(1, -1).trim();
            i++; // Skip next line since we processed it
          }

          currentMainSection.subsections?.push(subsection);
          continue;
        }
      }

      // Add the last section
      if (currentMainSection) {
        sections.push(currentMainSection);
      }

      console.log('Final parsed sections:', sections);

      if (sections.length === 0) {
        throw new Error('No sections were parsed from the outline');
      }

      dispatch(setSections(sections));

      setProgressState({
        progress: 100,
        message: 'Outline generated successfully!',
      });
    } catch (error) {
      console.error('Error generating outline:', error);
      dispatch(setError('Failed to generate outline. Please try again.'));
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleDocumentGeneration = async () => {
    if (!research.sections || research.sections.length === 0) {
      dispatch(setError('Please generate an outline first'));
      return;
    }

    setIsGeneratingDocument(true);
    setProgressState({
      progress: 0,
      message: 'Starting document generation...',
    });

    try {
      const totalSections = research.sections.length;
      let completedSections = 0;

      // Create a deep copy of sections to modify
      const updatedSections = research.sections.map(section => ({
        ...section,
        subsections: section.subsections?.map(sub => ({ ...sub }))
      }));

      // Generate content for each section
      for (let i = 0; i < updatedSections.length; i++) {
        let sectionSuccess = false;
        let retryCount = 0;
        const maxRetries = 8;
        const initialDelay = 1000;

        while (!sectionSuccess && retryCount < maxRetries) {
          try {
            const section = updatedSections[i];
            setProgressState({
              progress: (completedSections / totalSections) * 100,
              message: `Generating content for section ${section.number}: ${section.title}${retryCount > 0 ? ` (Retry ${retryCount}/${maxRetries})` : ''}...`,
            });

            // Generate content for main section
            const sectionContent = await researchApi.generateSectionBatch(
              [{
                title: section.title,
                content: section.content || '',
                subsections: section.subsections?.map(sub => ({
                  title: sub.title,
                  content: sub.content || ''
                }))
              }],
              research.researchTarget,
              research.mode as ResearchMode,
              research.type as ResearchType
            );

            if (!sectionContent?.[0]?.content) {
              throw new Error(`Failed to generate content for section ${section.number}`);
            }

            // Update the section with generated content
            updatedSections[i] = {
              ...updatedSections[i],
              content: sectionContent[0].content
            };

            // Generate content for subsections if they exist
            if (section.subsections && section.subsections.length > 0) {
              const subsectionContent = await researchApi.generateSectionBatch(
                section.subsections.map(sub => ({
                  title: sub.title,
                  content: sub.content || ''
                })),
                research.researchTarget,
                research.mode as ResearchMode,
                research.type as ResearchType
              );

              if (!subsectionContent?.length) {
                throw new Error(`Failed to generate content for subsections of section ${section.number}`);
              }

              updatedSections[i].subsections = section.subsections.map((subsection, idx) => ({
                ...subsection,
                content: subsectionContent[idx]?.content || subsection.content || ''
              }));
            }

            sectionSuccess = true;
            completedSections++;
            
            // Update Redux state after each section is completed
            dispatch(setSections(updatedSections.map(s => ({ ...s }))));

          } catch (sectionError) {
            console.error(`Error generating section ${i + 1} (Attempt ${retryCount + 1}/${maxRetries}):`, sectionError);
            retryCount++;

            if (retryCount < maxRetries) {
              const delayTime = initialDelay * Math.pow(2, retryCount - 1);
              dispatch(setError(`Retrying section ${i + 1} in ${delayTime / 1000} seconds...`));
              await new Promise(resolve => setTimeout(resolve, delayTime));
            } else {
              dispatch(setError(`Failed to generate section ${i + 1} after ${maxRetries} attempts. Continuing with remaining sections.`));
              break;
            }
          }
        }
      }

      setProgressState({
        progress: 100,
        message: 'Document generation completed!',
      });

    } catch (error) {
      console.error('Error generating document:', error);
      dispatch(setError('Failed to generate document. Please try again.'));
    } finally {
      setIsGeneratingDocument(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!research.title || !research.sections) {
      dispatch(setError('No content available to download'));
      return;
    }
    downloadMarkdown(research.title, research.sections);
  };

  const handleDownloadDocx = async () => {
    console.log('Download .docx clicked, state:', { 
      title: research.title, 
      sectionsCount: research.sections?.length,
      sections: research.sections 
    });

    if (!research.title || !research.sections) {
      dispatch(setError('No content available to download'));
      return;
    }

    try {
      console.log('Starting docx download...');
      await downloadDocx(research.title, research.sections);
      console.log('Download completed');
    } catch (error) {
      console.error('Error downloading document:', error);
      dispatch(setError('Failed to download document. Please try again.'));
    }
  };

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Remove quotes from start and end of title
    const cleanTitle = event.target.value.replace(/^["']|["']$/g, '');
    dispatch(setTitle(cleanTitle));
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      minHeight: '100vh',
      overflow: 'hidden', 
      width: '100vw',
      position: 'relative'
    }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          position: 'absolute',
          height: '100%',
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            position: 'relative',
            height: '100%',
            overflowY: 'auto',
            borderRight: '1px solid rgba(0, 0, 0, 0.12)'
          },
        }}
      >
        <Box sx={{ overflow: 'auto', p: 2, pt: 1 }}>
          <Typography variant="h5" sx={{ mb: 2 }}>
            AI Research Assistant
          </Typography>
          <Typography variant="body2" color="warning.main" sx={{ mb: 2 }}>
            ⚠️ Please Note: Research generation may take a long time due to multiple AI completions required for comprehensive content.
          </Typography>

          <Typography variant="h6" gutterBottom>
            Research Mode
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary="Basic Mode (5-7 pages)"
                secondary="Quick overview of topics, key points and main arguments. Suitable for brief reports."
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Advanced Mode (10-15 pages)"
                secondary="Detailed analysis, supporting evidence, citations and references. Balanced for most academic needs."
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Expert Mode (20+ pages)"
                secondary="Comprehensive coverage, in-depth analysis, extensive references. Suitable for thesis/dissertation."
              />
            </ListItem>
          </List>

          <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>
            Research Type
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary="General Research"
                secondary="Balanced mix of analysis, covers multiple perspectives, includes background information."
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Literature Review"
                secondary="Focus on existing research, analysis of current literature, comparison of different studies."
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Experimental Research"
                secondary="Methodology-focused, data analysis emphasis, results and discussion."
              />
            </ListItem>
          </List>

          <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>
            Generation Process
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary="1. Generate Target"
                secondary="Refines your research focus, creates structured approach, identifies key areas."
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="2. Generate Outline"
                secondary="Creates detailed structure, organizes main sections, adds relevant subsections."
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="3. Generate Research"
                secondary="Processes section by section, creates detailed content, adds citations and references."
              />
            </ListItem>
          </List>

          <Typography variant="h6" sx={{ mt: 3 }} gutterBottom>
            Best Practices
          </Typography>
          <List>
            <ListItem>
              <ListItemText
                primary="During Generation"
                secondary="Be patient with AI processing, watch progress bar for status, don't refresh the page."
              />
            </ListItem>
            <ListItem>
              <ListItemText
                primary="Export Options"
                secondary="Save work frequently using Markdown export, review each step's output."
              />
            </ListItem>
          </List>
        </Box>
      </Drawer>

      <Main>
        <Box sx={{ 
          width: '100%', 
          p: 2,
          pt: 1,
          '& .MuiPaper-root': {
            mb: 2,
            '&:last-child': {
              mb: 0
            }
          }
        }}>
          <Paper elevation={3} sx={{ width: '100%', boxSizing: 'border-box' }}>
            <Box sx={{ p: 2 }}>
              <Typography variant="h4" sx={{ mb: 2 }}>
                Research Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Research Mode</InputLabel>
                    <Select value={research.mode} onChange={handleModeChange}>
                      <MenuItem value={ResearchMode.Basic}>Basic</MenuItem>
                      <MenuItem value={ResearchMode.Advanced}>Advanced</MenuItem>
                      <MenuItem value={ResearchMode.Expert}>Expert</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Research Type</InputLabel>
                    <Select value={research.type} onChange={handleTypeChange}>
                      <MenuItem value={ResearchType.General}>General Research</MenuItem>
                      <MenuItem value={ResearchType.Literature}>Literature Review</MenuItem>
                      <MenuItem value={ResearchType.Experiment}>Experimental Research</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>
          </Paper>

          <Paper elevation={3} sx={{ width: '100%', boxSizing: 'border-box' }}>
            <Box sx={{ p: 2 }}>
              <Typography variant="h4" sx={{ mb: 2 }}>
                Document Generation
              </Typography>

              <TextField
                fullWidth
                label="Research Target"
                value={research.researchTarget}
                onChange={(e) => dispatch(setResearchTarget(e.target.value))}
                multiline
                rows={3}
                sx={{ mb: 2 }}
              />

              <Button
                fullWidth
                variant="contained"
                color="primary"
                onClick={handleTitleGeneration}
                disabled={!research.researchTarget || isGeneratingTitle}
                sx={{ mb: 2 }}
              >
                {isGeneratingTitle ? 'Generating Title...' : 'Generate Title'}
              </Button>

              {research.title && (
                <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>
                    Generated Title:
                  </Typography>
                  <TextField
                    fullWidth
                    value={research.title}
                    onChange={handleTitleChange}
                    variant="outlined"
                    size="small"
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: 'white'
                      }
                    }}
                  />
                </Box>
              )}

              {research.title && (
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={handleOutlineGeneration}
                  disabled={isGeneratingOutline || !research.researchTarget}
                  sx={{ mb: 2 }}
                >
                  {isGeneratingOutline ? 'Generating Outline...' : 'Generate Outline'}
                </Button>
              )}

              {research.sections && research.sections.length > 0 && (
                <Box sx={{ mb: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Generated Outline:
                  </Typography>
                  <List sx={{ 
                    width: '100%',
                    bgcolor: 'background.paper',
                    '& .MuiListItem-root': { 
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      py: 1
                    }
                  }}>
                    {research.sections.map((section) => (
                      <React.Fragment key={section.number}>
                        <ListItem>
                          <ListItemText
                            primary={
                              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                {section.number}. {section.title}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {section.content}
                              </Typography>
                            }
                          />
                          {section.subsections && section.subsections.length > 0 && (
                            <List sx={{ 
                              width: '100%',
                              pl: 3,
                              '& .MuiListItem-root': {
                                py: 0.5
                              }
                            }}>
                              {section.subsections.map((subsection) => (
                                <ListItem key={subsection.number}>
                                  <ListItemText
                                    primary={
                                      <Typography variant="body2" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                                        {subsection.number} {subsection.title}
                                      </Typography>
                                    }
                                    secondary={
                                      <Typography variant="body2" color="text.secondary">
                                        {subsection.content}
                                      </Typography>
                                    }
                                  />
                                </ListItem>
                              ))}
                            </List>
                          )}
                        </ListItem>
                        <Divider sx={{ my: 1 }} />
                      </React.Fragment>
                    ))}
                  </List>
                </Box>
              )}

              {(isGeneratingTitle || isGeneratingOutline || isGeneratingDocument) && (
                <Box sx={{ width: '100%', mb: 2 }}>
                  <LinearProgress variant="determinate" value={progressState.progress} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {progressState.message}
                  </Typography>
                </Box>
              )}

              {research.sections && research.sections.length > 0 && (
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleDocumentGeneration}
                    disabled={isGeneratingDocument}
                    fullWidth
                  >
                    {isGeneratingDocument ? 'Generating...' : 'Generate Document'}
                  </Button>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={handleDownloadMarkdown}
                    disabled={!research.sections || research.sections.length === 0}
                    startIcon={<DownloadIcon />}
                  >
                    Download Markup
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleDownloadDocx}
                    disabled={!research.sections || research.sections.length === 0}
                    startIcon={<DownloadIcon />}
                  >
                    Download .docx
                  </Button>
                </Box>
              )}
            </Box>
          </Paper>
        </Box>
      </Main>
    </Box>
  );
};

export default ResearchPage;
