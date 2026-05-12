import { buildDocx, Packer } from '@/utils/buildDocx';
import axios from 'axios';

export async function exportPdf(resume, { sectionOrder, scale = 1, filename, getToken, backendUrl }) {
  const resumeData = sectionOrder ? { ...resume, sectionOrder } : resume;
  const doc = buildDocx(resumeData, scale);
  const docxBlob = await Packer.toBlob(doc);
  const formData = new FormData();
  formData.append('file', new File([docxBlob], 'resume.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }));
  const token = await getToken();
  const response = await axios.post(`${backendUrl}/file/convert-to-pdf`, formData, {
    headers: { Authorization: `Bearer ${token}` },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function exportDocx(resume, { sectionOrder, scale = 1, filename }) {
  const resumeData = sectionOrder ? { ...resume, sectionOrder } : resume;
  const doc = buildDocx(resumeData, scale);
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}
