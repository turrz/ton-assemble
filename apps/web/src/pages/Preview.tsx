import { useParams, Link } from 'react-router-dom';

export default function Preview() {
  const { siteId } = useParams<{ siteId: string }>();
  const apiUrl = import.meta.env.VITE_API_URL || '';
  const previewSrc = siteId ? `${apiUrl}/preview/${siteId}` : '';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-tg-text">Preview</h1>
        <Link
          to={siteId ? `/publish/${siteId}` : '/sites'}
          className="rounded-lg bg-tg-button px-3 py-1.5 text-sm font-medium text-tg-button-text"
        >
          Publish
        </Link>
      </div>
      {previewSrc ? (
        <iframe
          src={previewSrc}
          title="Site preview"
          className="h-[70vh] w-full rounded-xl border border-white/10 bg-white/5"
          sandbox="allow-scripts"
        />
      ) : (
        <p className="text-sm text-tg-hint">No site selected.</p>
      )}
    </div>
  );
}
