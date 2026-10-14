import { features as f } from './features.ts';
import { defineVoiceAction as action, textField as text, longTextField as longText, numberField as number, targetField as target, choiceField as choice } from './types.ts';
const file = { type: 'file', label: 'Choose file', required: true } as const;
const document = { documentId: target('Document', 'documents') };
export const documentActions = {
  upload_document: action({ label: 'Upload document', icon: 'cloud-upload-outline', permission: f.documents.actions.create,
    instruction: 'Upload a document/plan. The reviewer must choose the actual file; never supply a path or file bytes.', fields: { file, categoryId: target('Folder', 'documentCategories') } }),
  rename_document: action({ label: 'Rename document', icon: 'create-outline', permission: f.documents.actions.edit, online: true,
    instruction: 'Rename an existing document.', fields: { ...document, fileName: text('New name') } }),
  upload_document_version: action({ label: 'Upload document revision', icon: 'cloud-upload-outline', permission: f.documents.actions.edit, online: true,
    instruction: 'Add a new revision to an existing document. The reviewer chooses the file.', fields: { ...document, file, revisionLabel: text('Revision label', false), notes: longText('Revision notes', false) } }),
  download_document: action({ label: 'Download document', icon: 'download-outline', permission: f.documents.read, online: true,
    instruction: 'Download the current revision of a named document for offline reading.', fields: document }),
  open_document: action({ label: 'Open document', icon: 'document-text-outline', permission: f.documents.read,
    instruction: 'Open a named document/plan for reading at its current revision.', fields: document }),
  delete_document: action({ label: 'Delete document', icon: 'trash-outline', permission: f.documents.actions.remove, online: true, destructive: true,
    instruction: 'Delete an existing document only when explicitly requested.', fields: document }),
  annotate_drawing: action({ label: 'Annotate drawing', icon: 'location-outline', permission: f.documents.actions.markup,
    instruction: 'Add a text pin to a drawing revision. Ask for the page and horizontal/vertical position in percent of the page (0 to 100 from its top-left) if not given. Never guess a position.',
    fields: { documentId: target('Drawing', 'drawings'), pageNo: number('Page number', 1), x: { ...number('Across page (%)'), max: 100 }, y: { ...number('Down page (%)'), max: 100 }, body: longText('Annotation') } }),
  comment_drawing: action({ label: 'Comment on drawing pin', icon: 'chatbubble-outline', permission: f.documents.actions.markup,
    instruction: 'Add a comment to an existing drawing pin on its original revision.', fields: { markupId: target('Pin', 'markups'), body: longText('Comment') } }),
  resolve_drawing: action({ label: 'Resolve or reopen drawing pin', icon: 'checkmark-circle-outline', permission: f.documents.actions.markup,
    instruction: 'Resolve or reopen an existing drawing pin.', fields: { markupId: target('Pin', 'markups'), status: choice('Status', ['resolved', 'open']) } }),
  delete_drawing: action({ label: 'Delete drawing annotation', icon: 'trash-outline', permission: f.documents.actions.markup, destructive: true,
    instruction: 'Delete an existing drawing annotation only when explicitly requested.', fields: { markupId: target('Annotation', 'markups') } }),
} as const;
