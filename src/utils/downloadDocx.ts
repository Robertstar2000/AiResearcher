import { Document, Paragraph, HeadingLevel, TableOfContents, PageNumber, AlignmentType, TextRun, Header, NumberFormat } from 'docx';
import { ResearchSection } from '../types/research';
import { Packer } from 'docx';

export const downloadDocx = async (title: string, sections: ResearchSection[]) => {
  console.log('Starting docx generation with:', { title, sectionCount: sections?.length });
  
  if (!title || !sections?.length) {
    throw new Error('Invalid document data');
  }

  try {
    console.log('Creating document structure...');
    const doc = new Document({
      title,
      sections: [{
        properties: {
          page: {
            pageNumbers: {
              start: 1,
              formatType: NumberFormat.DECIMAL
            }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    children: ["Page ", PageNumber.CURRENT]
                  })
                ]
              })
            ]
          })
        },
        children: [
          // Title
          new Paragraph({
            text: title,
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 400
            }
          }),

          // Table of Contents
          new TableOfContents("Table of Contents", {
            hyperlink: true,
            headingStyleRange: "1-3"
          }),

          // Add page break after TOC
          new Paragraph({
            children: [new TextRun({ break: 1 })]
          }),

          // Sections
          ...sections.flatMap(section => [
            // Main section
            new Paragraph({
              text: `${section.number}. ${section.title}`,
              heading: HeadingLevel.HEADING_1,
              spacing: {
                before: 400,
                after: 200
              }
            }),
            new Paragraph({
              text: section.content || '',
              spacing: {
                after: 200
              }
            }),

            // Subsections
            ...(section.subsections?.flatMap(subsection => [
              new Paragraph({
                text: `${subsection.number} ${subsection.title}`,
                heading: HeadingLevel.HEADING_2,
                spacing: {
                  before: 300,
                  after: 200
                }
              }),
              new Paragraph({
                text: subsection.content || '',
                spacing: {
                  after: 200
                }
              })
            ]) || [])
          ])
        ]
      }]
    });

    console.log('Document structure created, generating blob...');
    // Generate blob directly using toBlob() for browser environment
    const blob = await Packer.toBlob(doc);
    console.log('Blob generated, size:', blob.size);

    // Create filename
    const fileName = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.docx`;
    console.log('Attempting to download as:', fileName);

    // Create object URL
    const url = window.URL.createObjectURL(blob);
    console.log('Created object URL:', url);

    // Create and trigger download
    const downloadLink = document.createElement('a');
    downloadLink.style.display = 'none';
    downloadLink.href = url;
    downloadLink.download = fileName;
    document.body.appendChild(downloadLink);

    // Trigger in a timeout to ensure proper rendering
    setTimeout(() => {
      console.log('Triggering download click');
      downloadLink.click();
      document.body.removeChild(downloadLink);
      // Delay revoking the object URL to ensure download starts
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        console.log('Cleaned up object URL');
      }, 1000);
    }, 100);

  } catch (error) {
    console.error('Error in downloadDocx:', error);
    throw error;
  }
};
