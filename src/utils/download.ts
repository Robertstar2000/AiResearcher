import { ResearchSection } from '../types/research';

export const downloadMarkdown = (title: string, sections: ResearchSection[]) => {
  const content = [
    `# ${title}\n\n`,
    ...sections.map(section => {
      const sectionContent = [
        `## ${section.number}. ${section.title}\n`,
        section.content ? `${section.content}\n\n` : '\n',
        ...(section.subsections?.map(subsection => (
          `### ${subsection.number} ${subsection.title}\n${subsection.content || ''}\n\n`
        )) || [])
      ].join('');
      return sectionContent;
    })
  ].join('\n');

  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
