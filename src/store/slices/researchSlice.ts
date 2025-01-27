import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ResearchSection } from '../../types/research';
import { ResearchMode, ResearchType } from '../../services/api';

interface ResearchState {
  mode: ResearchMode;
  type: ResearchType;
  researchTarget: string;
  title?: string;
  sections?: ResearchSection[];
  error?: string;
}

const initialState: ResearchState = {
  mode: ResearchMode.Basic,
  type: ResearchType.General,
  researchTarget: '',
};

export const researchSlice = createSlice({
  name: 'research',
  initialState,
  reducers: {
    setMode: (state, action: PayloadAction<ResearchMode>) => {
      state.mode = action.payload;
    },
    setType: (state, action: PayloadAction<ResearchType>) => {
      state.type = action.payload;
    },
    setResearchTarget: (state, action: PayloadAction<string>) => {
      state.researchTarget = action.payload;
    },
    setSections: (state, action: PayloadAction<ResearchSection[]>) => {
      state.sections = action.payload;
    },
    setTitle: (state, action: PayloadAction<string>) => {
      console.log('Setting title in reducer:', action.payload);
      state.title = action.payload;
      console.log('Title set in state:', state.title);
    },
    setError: (state, action: PayloadAction<string | undefined>) => {
      state.error = action.payload;
    },
  },
});

export const { setMode, setType, setResearchTarget, setSections, setTitle, setError } = researchSlice.actions;

export default researchSlice.reducer;
