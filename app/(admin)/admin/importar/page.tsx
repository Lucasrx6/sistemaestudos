'use client';

import { useMemo, useState } from 'react';

type ImportResult = {
  inseridas: number;
  erros: Array<{ indice: number; motivo: string; questao: unknown }>;
  concursosCriados?: string[];
};

export default function AdminImportarPage() {
  const [jsonContent, setJsonContent] = useState('');
  const [preview, setPreview] = useState<any[]>([]);
  const [metadataPreview, setMetadataPreview] = useState<any | null>(null);
  const [suggestionsPreview, setSuggestionsPreview] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setParseError(null);
    setResult(null);

    const file = event.target.files?.[0];
    if (!file) {
      setJsonContent('');
      setPreview([]);
      return;
    }

    const text = await file.text();
    setJsonContent(text);

    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.questoes)) {
        setParseError('O JSON deve conter um campo "questoes" com um array.');
        setPreview([]);
        setMetadataPreview(null);
        setSuggestionsPreview([]);
        return;
      }
      setPreview(parsed.questoes.slice(0, 5));
      setMetadataPreview(parsed.metadata ?? null);
      setSuggestionsPreview(Array.isArray(parsed.concursos_sugeridos) ? parsed.concursos_sugeridos.slice(0, 5) : []);
    } catch (err) {
      setParseError('JSON inválido. Verifique a sintaxe.');
      setPreview([]);
      setMetadataPreview(null);
      setSuggestionsPreview([]);
    }
  };

  const handleImport = async () => {
    setParseError(null);
    setLoading(true);
    setResult(null);

    try {
      const body = JSON.parse(jsonContent);
      const response = await fetch('/api/admin/questoes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      if (!response.ok) {
        setParseError(data.error?.message || 'Falha na importação.');
      } else {
        setResult(data);
      }
    } catch (error) {
      setParseError('Erro ao enviar importação. Verifique o JSON.');
    } finally {
      setLoading(false);
    }
  };

  const hasPreview = useMemo(() => preview.length > 0, [preview]);

  return (
    <main className="container py-5">
      <h1>Importar questões</h1>
      <p className="text-muted">Faça upload de JSON em massa e valide cada questão.</p>

      <div className="card shadow-sm p-4 mb-4">
        <div className="mb-3">
          <label className="form-label">Arquivo JSON</label>
          <input type="file" className="form-control" accept="application/json" onChange={handleFile} />
        </div>
        <div className="mb-3">
          <label className="form-label">Conteúdo JSON</label>
          <textarea
            className="form-control"
            rows={10}
            value={jsonContent}
            onChange={(event) => setJsonContent(event.target.value)}
            placeholder="Cole o JSON ou selecione um arquivo..."
          />
        </div>
        {parseError && <div className="alert alert-danger">{parseError}</div>}
        <button className="btn btn-primary" onClick={handleImport} disabled={loading || !jsonContent}>
          {loading ? 'Importando...' : 'Importar questões'}
        </button>
      </div>

      {hasPreview && (
        <div className="card shadow-sm mb-4">
          <div className="card-body">
            <h2 className="h5">Preview das primeiras 5 questões</h2>
            {metadataPreview && (
              <div className="mb-3">
                <strong>Metadados:</strong>
                <pre className="bg-light p-3 rounded">{JSON.stringify(metadataPreview, null, 2)}</pre>
              </div>
            )}
            {suggestionsPreview.length > 0 && (
              <div className="mb-3">
                <strong>Concursos sugeridos:</strong>
                <ul>
                  {suggestionsPreview.map((concurso, index) => (
                    <li key={index}>{concurso.slug} — {concurso.nome}</li>
                  ))}
                </ul>
              </div>
            )}
            {preview.map((questao, index) => (
              <div key={index} className="mb-3 border-bottom pb-3">
                <strong>{index + 1}. {questao.tipo}</strong>
                <p>{questao.enunciado}</p>
                {Array.isArray(questao.concursos) && questao.concursos.length > 0 && (
                  <p className="mb-0"><small>Concursos: {questao.concursos.join(', ')}</small></p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {result && (
        <div className="card shadow-sm">
          <div className="card-body">
            <h2 className="h5">Resultado da importação</h2>
            <p>{result.inseridas} questão(ões) inserida(s).</p>
            {result.concursosCriados && result.concursosCriados.length > 0 && (
              <div className="mb-3">
                <strong>Concursos criados automaticamente:</strong>
                <p>{result.concursosCriados.join(', ')}</p>
              </div>
            )}
            {result.erros.length > 0 ? (
              <div>
                <p className="text-danger">Foram encontrados erros em algumas questões:</p>
                <ul>
                  {result.erros.map((erro) => (
                    <li key={erro.indice}>
                      Questão {erro.indice + 1}: {erro.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="alert alert-success">Importação concluída sem erros.</div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
