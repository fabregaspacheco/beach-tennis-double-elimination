import { useState } from 'react';
import type { Sponsor } from '../types';

interface SponsorsPanelProps {
  sponsors: Sponsor[];
  reusableSponsors: Sponsor[];
  onAdd: (name: string, file: File) => Promise<void>;
  onReuse: (sponsor: Sponsor) => void;
  onRemove: (sponsor: Sponsor) => void;
}

export function SponsorsPanel({ sponsors, reusableSponsors, onAdd, onReuse, onRemove }: SponsorsPanelProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !file) {
      setError('Escolha um nome e uma imagem.');
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      await onAdd(name.trim(), file);
      setName('');
      setFile(null);
      setFormOpen(false);
    } catch {
      setError('Não foi possível enviar o logo. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="sponsors-panel">
      <div className="sponsors-panel-header">
        <h4>Patrocinadores</h4>
        <button
          type="button"
          className="btn btn--link"
          onClick={() => {
            setFormOpen((v) => !v);
            setError(null);
          }}
        >
          {formOpen ? 'Cancelar' : '+ Adicionar'}
        </button>
      </div>

      {sponsors.length > 0 && (
        <ul className="sponsors-list">
          {sponsors.map((s) => (
            <li key={s.id} className="sponsor-card">
              <button
                type="button"
                className="sponsor-card-remove"
                onClick={() => onRemove(s)}
                aria-label={`Remover ${s.name}`}
              >
                ×
              </button>
              <img src={s.logoUrl} alt={s.name} />
              <span>{s.name}</span>
            </li>
          ))}
        </ul>
      )}
      {sponsors.length === 0 && !formOpen && <p className="sponsors-empty">Nenhum patrocinador ainda.</p>}

      {formOpen && (
        <div className="sponsor-form">
          {reusableSponsors.length > 0 && (
            <div className="sponsor-reuse">
              <span className="sponsor-reuse-label">Reutilizar patrocinador já cadastrado</span>
              <div className="sponsor-reuse-list">
                {reusableSponsors.map((s) => (
                  <button
                    key={s.logoPath}
                    type="button"
                    className="sponsor-reuse-item"
                    onClick={() => onReuse(s)}
                    title={`Adicionar ${s.name}`}
                  >
                    <img src={s.logoUrl} alt={s.name} />
                    <span>{s.name}</span>
                  </button>
                ))}
              </div>
              <span className="sponsor-reuse-divider">ou envie um novo logo</span>
            </div>
          )}
          <div className="sponsor-form-upload">
            <input type="text" placeholder="Nome do patrocinador" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <button type="button" className="btn btn--primary btn--small" onClick={submit} disabled={isUploading}>
              {isUploading ? 'Enviando…' : 'Adicionar'}
            </button>
          </div>
          {error && <p className="modal-error">{error}</p>}
        </div>
      )}
    </section>
  );
}
