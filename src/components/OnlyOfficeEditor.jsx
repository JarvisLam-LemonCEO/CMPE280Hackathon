import { DocumentEditor } from "@onlyoffice/document-editor-react";

export default function OnlyOfficeEditor({ file }) {
  return (
    <div className="h-[80vh] w-full">
      <DocumentEditor
        id="onlyoffice-editor"
        documentServerUrl="http://localhost:80/"
        config={{
          document: {
            fileType: file.originalFilename?.split(".").pop() || "docx",
            key: file.id,
            title: file.title || file.originalFilename,
            url: file.url,
          },
          documentType: file.originalFilename?.endsWith(".pptx")
            ? "slide"
            : "word",
          editorConfig: {
            mode: "edit",
            callbackUrl: "http://localhost:5173/api/onlyoffice/callback",
          },
        }}
      />
    </div>
  );
}