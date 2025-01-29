import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
  Divider,
  CircularProgress,
} from '@mui/material';
import { RootState } from '../store/store';
import { setMode, setResearchTarget, setTitle, setType, setSections, setError } from '../store/slices/researchSlice';
import { generateOutline, parseOutline } from '../services/researchService';
import { downloadMarkdown } from '../utils/download';
import { downloadDocx } from '../utils/downloadDocx';
import type { ResearchSection } from '../types/research';
import { ResearchMode, ResearchType, researchApi } from '../services/api';

const ResearchPage = () => {
  const dispatch = useDispatch();
  const research = useSelector((state: RootState) => state.research);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);
  const [progressState, setProgressState] = useState<{
    progress: number;
    message: string;
  }>({
    progress: 0,
    message: '',
  });

  const handleModeChange = (event: SelectChangeEvent) => {
    dispatch(setMode(event.target.value as ResearchMode));
  };

  const handleTypeChange = (event: SelectChangeEvent) => {
    dispatch(setType(event.target.value as ResearchType));
  };

  const handleResearchTargetChange = (event: { target: { value: string } }) => {
    dispatch(setResearchTarget(event.target.value));
  };

  const handleTitleChange = (event: { target: { value: string } }) => {
    dispatch(setTitle(event.target.value));
  };

  const handleGenerateTitle = async () => {
    if (!research.researchTarget) {
      dispatch(setError('Please enter research target text first'));
      return;
    }

    console.log('Starting title generation for:', research.researchTarget);
    setIsGeneratingTitle(true);
    setProgressState({
      progress: 0,
      message: 'Generating academic title...',
    });

    try {
      console.log('Calling researchApi.generateTitle...');
      const title = await researchApi.generateTitle(research.researchTarget);
      console.log('Generated title:', title);
      
      // Store the title in local variable before dispatching
      const generatedTitle = title.trim();
      console.log('About to dispatch title:', generatedTitle);
      dispatch(setTitle(generatedTitle));
      console.log('Title dispatched:', generatedTitle);

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

  const handleGenerateOutline = async () => {
    if (!research.researchTarget) {
      dispatch(setError('Please enter research target text first'));
      return;
    }

    setIsGeneratingOutline(true);
    setProgressState({
      progress: 0,
      message: 'Generating outline...',
    });

    try {
      const outlineText = await generateOutline(
        research.researchTarget,
        research.mode,
        research.type
      );
      const sections = parseOutline(outlineText);
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

  const handleGenerateDocument = async () => {
    if (!research.sections || research.sections.length === 0) {
      dispatch(setError('Please generate an outline first'));
      return;
    }

    setIsGeneratingDocument(true);
    const maxRetries = 3;
    const totalSections = research.sections.length;
    let completedSections = 0;

    const updatedSections = [...research.sections];
    const sectionDelay = 2000; // 2 second delay between sections

    for (let i = 0; i < updatedSections.length; i++) {
      let sectionSuccess = false;
      let retryCount = 0;
      const section = updatedSections[i];

      // Add delay between sections (except for the first one)
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, sectionDelay));
      }

      while (!sectionSuccess && retryCount < maxRetries) {
        try {
          setProgressState({
            progress: (completedSections / totalSections) * 100,
            message: `Generating content for section ${section.number}: ${section.title}${retryCount > 0 ? ` (Retry ${retryCount}/${maxRetries})` : ''}...`,
          });

          // Generate content for this section using batch generation with size 1
          const [sectionWithContent] = await researchApi.generateSectionBatch(
            [section],
            research.researchTarget,
            research.mode as ResearchMode,
            research.type as ResearchType
          );

          if (!sectionWithContent || !sectionWithContent.content) {
            throw new Error('No content generated for section');
          }

          updatedSections[i] = {
            ...updatedSections[i],
            content: sectionWithContent.content
          };

          // Add delay before generating subsections
          if (section.subsections && section.subsections.length > 0) {
            await new Promise(resolve => setTimeout(resolve, sectionDelay));
            
            // Generate content for subsections using batch generation
            const subsectionResults = await researchApi.generateSectionBatch(
              section.subsections,
              research.researchTarget,
              research.mode as ResearchMode,
              research.type as ResearchType
            );

            if (!subsectionResults || !Array.isArray(subsectionResults)) {
              throw new Error('Invalid subsection results');
            }

            updatedSections[i].subsections = section.subsections.map((subsection, idx) => ({
              ...subsection,
              content: subsectionResults[idx]?.content || ''
            }));
          }

          sectionSuccess = true;
          completedSections++;
          dispatch(setSections([...updatedSections]));

        } catch (error) {
          console.error(`Error generating section ${section.number}:`, error);
          retryCount++;
          
          if (retryCount >= maxRetries) {
            dispatch(setError(`Failed to generate content for section ${section.number} after ${maxRetries} attempts`));
            setIsGeneratingDocument(false);
            return;
          }
          
          // Start at 5 seconds and double each retry, max 700 seconds
          const baseDelay = 5000; // 5 seconds
          const retryDelay = Math.min(baseDelay * Math.pow(2, retryCount), 700000); // max 700 seconds
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    setProgressState({
      progress: 100,
      message: 'Document generated successfully!',
    });
    setIsGeneratingDocument(false);
  };

  const handleDownloadMarkdown = () => {
    if (!research.title || !research.sections) {
      dispatch(setError('No content available to download'));
      return;
    }

    try {
      downloadMarkdown(research.title, research.sections);
    } catch (error) {
      console.error('Error downloading markdown:', error);
      dispatch(setError('Failed to download markdown. Please try again.'));
    }
  };

  const handleDownloadDocx = async () => {
    if (!research.title || !research.sections) {
      dispatch(setError('No content available to download'));
      return;
    }

    try {
      await downloadDocx(research.title, research.sections);
    } catch (error) {
      console.error('Error downloading document:', error);
      dispatch(setError('Failed to download document. Please try again.'));
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100%' }}>
      <Box sx={{ width: '250px', flexShrink: 0, p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>AI Research Assistant</Typography>
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mb: 2 }}>
          ⚠️ Please Note: Research generation may take a long time due to multiple AI completions required for comprehensive content.
        </Typography>
        
        <Typography variant="subtitle1" sx={{ mt: 3, mb: 1, fontWeight: 'bold' }}>Getting Started</Typography>
        
        <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 'bold' }}>1. Account Setup & Security</Typography>
        <Typography variant="body2" sx={{ ml: 1 }}>
          • Creating an Account:<br/>
          - Click "Sign Up" in the top navigation<br/>
          - Enter your email address<br/>
          - Create a strong password<br/>
          - Verify your email
        </Typography>

        <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 'bold' }}>2. Research Settings</Typography>
        <Typography variant="body2" sx={{ ml: 1 }}>
          • Research Mode determines depth & length<br/>
          • Research Type determines approach<br/>
          • Configure both before starting
        </Typography>

        <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 'bold' }}>3. Research Process</Typography>
        <Typography variant="body2" sx={{ ml: 1 }}>
          1. Enter research target<br/>
          2. Generate title<br/>
          3. Generate outline<br/>
          4. Generate document<br/>
          5. Download in preferred format
        </Typography>

        <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 'bold' }}>4. Tips</Typography>
        <Typography variant="body2" sx={{ ml: 1 }}>
          • Be patient during generation<br/>
          • Don't refresh the page<br/>
          • Save work regularly<br/>
          • Export to Markdown for backup
        </Typography>

        <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 'bold' }}>5. Expected Output</Typography>
        <Typography variant="body2" sx={{ ml: 1 }}>
          • Title page and abstract<br/>
          • Table of contents<br/>
          • Numbered sections<br/>
          • References and appendices
        </Typography>

        <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 'bold' }}>6. Citations and References</Typography>
        <Typography variant="body2" sx={{ ml: 1 }}>
          • In-text citations<br/>
          • Alphabetized references<br/>
          • DOI and URL links<br/>
          • Multiple source formats
        </Typography>

        <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 'bold' }}>7. Strengths and Limitations</Typography>
        <Typography variant="body2" sx={{ ml: 1 }}>
          • Fast document generation<br/>
          • Consistent formatting<br/>
          • Verify citations manually<br/>
          • Use as research aid
        </Typography>
      </Box>
      <Box sx={{ 
        flexGrow: 1, 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <Box sx={{ width: '100%', maxWidth: 'md' }}>
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Research Target"
              value={research.researchTarget}
              onChange={handleResearchTargetChange}
              placeholder="Enter your research topic or question here..."
              size="small"
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: '0.875rem',
                  py: 0.5
                },
                '& .MuiInputLabel-root': {
                  fontSize: '0.875rem'
                }
              }}
            />
          </Box>

          <Box sx={{ mt: 3 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Research Title"
              value={research.title || ''}
              onChange={handleTitleChange}
              variant="outlined"
              disabled={isGeneratingTitle}
              placeholder="Your research title will appear here..."
              size="small"
              sx={{
                '& .MuiInputBase-input': {
                  color: '#1976d2',
                  fontWeight: 'bold',
                  fontSize: '0.875rem',
                  py: 0.5
                },
                '& .MuiInputLabel-root': {
                  fontSize: '0.875rem'
                }
              }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Box sx={{ flex: 1 }}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ 
                  fontSize: '0.875rem',
                  '&.MuiInputLabel-shrink': {
                    transform: 'translate(14px, -18px) scale(0.75)'
                  }
                }}>Research Mode</InputLabel>
                <Select 
                  value={research.mode} 
                  onChange={handleModeChange}
                  sx={{ 
                    '& .MuiSelect-select': { 
                      fontSize: '0.875rem',
                      py: 0.5
                    }
                  }}
                >
                  <MenuItem value="basic" sx={{ fontSize: '0.875rem' }}>Basic</MenuItem>
                  <MenuItem value="advanced" sx={{ fontSize: '0.875rem' }}>Advanced</MenuItem>
                  <MenuItem value="expert" sx={{ fontSize: '0.875rem' }}>Expert</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ flex: 1 }}>
              <FormControl fullWidth size="small">
                <InputLabel sx={{ 
                  fontSize: '0.875rem',
                  '&.MuiInputLabel-shrink': {
                    transform: 'translate(14px, -18px) scale(0.75)'
                  }
                }}>Research Type</InputLabel>
                <Select 
                  value={research.type} 
                  onChange={handleTypeChange}
                  sx={{ 
                    '& .MuiSelect-select': { 
                      fontSize: '0.875rem',
                      py: 0.5
                    }
                  }}
                >
                  <MenuItem value="general" sx={{ fontSize: '0.875rem' }}>General Research</MenuItem>
                  <MenuItem value="literature" sx={{ fontSize: '0.875rem' }}>Literature Review</MenuItem>
                  <MenuItem value="experiment" sx={{ fontSize: '0.875rem' }}>Experimental Research</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mt: 3, justifyContent: 'flex-start', flexWrap: 'nowrap' }}>
            <Button
              variant="contained"
              size="small"
              onClick={handleGenerateTitle}
              disabled={isGeneratingTitle || !research.researchTarget}
              sx={{ fontSize: '1rem' }}
            >
              Generate Title
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleGenerateOutline}
              disabled={isGeneratingOutline || !research.title}
              sx={{ fontSize: '1rem' }}
            >
              Generate Outline
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={handleGenerateDocument}
              disabled={isGeneratingDocument || !research.sections || research.sections.length === 0}
              sx={{ fontSize: '1rem' }}
            >
              Generate Document
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={handleDownloadMarkdown}
              disabled={!research.sections || research.sections.length === 0}
              sx={{ 
                fontSize: '1rem',
                ...(research.sections && research.sections.length > 0 && !isGeneratingDocument && progressState.progress === 100 && {
                  backgroundColor: '#1976d2',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: '#1565c0'
                  }
                })
              }}
            >
              Download .md
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={handleDownloadDocx}
              disabled={!research.sections || research.sections.length === 0}
              sx={{ 
                fontSize: '1rem',
                ...(research.sections && research.sections.length > 0 && !isGeneratingDocument && progressState.progress === 100 && {
                  backgroundColor: '#1976d2',
                  color: 'white',
                  '&:hover': {
                    backgroundColor: '#1565c0'
                  }
                })
              }}
            >
              Download .docx
            </Button>
          </Box>

          {(isGeneratingTitle || isGeneratingOutline || isGeneratingDocument) && (
            <Box sx={{ width: '100%', mt: 3 }}>
              <LinearProgress variant="determinate" value={progressState.progress} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                {isGeneratingDocument && progressState.progress < 100 && (
                  <CircularProgress size={16} />
                )}
                <Typography variant="caption">
                  {progressState.message}
                </Typography>
              </Box>
            </Box>
          )}

          {research.sections && research.sections.length > 0 && (
            <Box sx={{ width: '100%', mt: 3 }}>
              <Paper sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Document Outline
                </Typography>
                <List>
                  {(research.sections || []).map((section: ResearchSection) => (
                    <Box key={section.number}>
                      <ListItem>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle1" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
                              {section.number}. {section.title}
                            </Typography>
                          }
                          secondary={section.content}
                        />
                      </ListItem>
                      {section.subsections && section.subsections.length > 0 && (
                        <List sx={{ pl: 4 }}>
                          {section.subsections.map((subsection: ResearchSection) => (
                            <ListItem key={`${section.number}-${subsection.number}`}>
                              <ListItemText
                                primary={
                                  <Typography variant="subtitle2" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
                                    {subsection.number} {subsection.title}
                                  </Typography>
                                }
                                secondary={subsection.content}
                              />
                            </ListItem>
                          ))}
                        </List>
                      )}
                      <Divider sx={{ my: 1 }} />
                    </Box>
                  ))}
                </List>
              </Paper>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ResearchPage;
