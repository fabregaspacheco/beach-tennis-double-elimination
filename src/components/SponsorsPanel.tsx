import { useState } from 'react';
import type { Sponsor } from '../types';

interface SponsorsPanelProps {
  sponsors: Sponsor[];
  reusableSponsors: Sponsor[];
  onAdd: (name: string, file: File) => Promise<void>;
  onReuse: (sponsor: Sponsor) => void;
  onRemove: (sponsor: Sponsor) => void;
  onForget: (sponsor: Sponsor) => void;
  locked?: boolean;
}

export function SponsorsPanel({
  sponsors,
  reusableSponsors,
  onAdd,
  onReuse,
  onRemove,
  onForget,
  locked = false,
}: SponsorsPanelProps) {
  // Collapsed by default — this is set up once and doesn't need to stay big on screen every time.
  const [collapsed, setCollapsed] = useState(true);
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
    <section className={`sponsors-panel${collapsed ? ' sponsors-panel--collapsed' : ''}`}>
      <button type="button" className="sponsors-panel-header" onClick={() => setCollapsed((v) => !v)}>
        <span className="sponsors-panel-toggle">{collapsed ? '▸' : '▾'}</span>
        <h4>
          Patrocinadores{sponsors.length > 0 && <span className="sponsors-panel-count"> ({sponsors.length})</span>}
        </h4>
        {collapsed && sponsors.length > 0 && (
          <span className="sponsors-panel-preview">
            {sponsors.slice(0, 6).map((s) => (
              <img key={s.id} src={s.logoUrl} alt={s.name} title={s.name} />
            ))}
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="sponsors-panel-body">
          {!locked && (
            <div className="sponsors-panel-body-header">
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
          )}

          {sponsors.length > 0 && (
            <ul className="sponsors-list">
              {sponsors.map((s) => (
                <li key={s.id} className="sponsor-card">
                  <img src={s.logoUrl} alt={s.name} />
                  <span>{s.name}</span>
                  {!locked && (
                    <button
                      type="button"
                      className="sponsor-card-remove"
                      onClick={() => onRemove(s)}
                      title={`Remover ${s.name} deste torneio`}
                    >
                      Remover
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {sponsors.length === 0 && !formOpen && <p className="sponsors-empty">Nenhum patrocinador ainda.</p>}

          {!locked && formOpen && (
            <div className="sponsor-form">
              {reusableSponsors.length > 0 && (
                <div className="sponsor-reuse">
                  <span className="sponsor-reuse-label">Reutilizar patrocinador já cadastrado</span>
                  <div className="sponsor-reuse-list">
                    {reusableSponsors.map((s) => (
                      <div key={s.logoPath} className="sponsor-reuse-item">
                        <button
                          type="button"
                          className="sponsor-reuse-pick"
                          onClick={() => onReuse(s)}
                          title={`Adicionar ${s.name}`}
                        >
                          <img src={s.logoUrl} alt={s.name} />
                          <span>{s.name}</span>
                        </button>
                        <button
                          type="button"
                          className="sponsor-reuse-forget"
                          onClick={() => onForget(s)}
                          title={`Esquecer ${s.name} (remove de todos os torneios)`}
                          aria-label={`Esquecer ${s.name}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <span className="sponsor-reuse-divider">ou envie um novo logo</span>
                </div>
              )}
              <div className="sponsor-form-upload">
                <input
                  type="text"
                  placeholder="Nome do patrocinador"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <button type="button" className="btn btn--primary btn--small" onClick={submit} disabled={isUploading}>
                  {isUploading ? 'Enviando…' : 'Adicionar'}
                </button>
              </div>
              {error && <p className="modal-error">{error}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
