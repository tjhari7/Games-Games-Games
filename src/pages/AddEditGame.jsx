import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { api } from '../lib/api.js';

const emptyForm = {
  title: '',
  type_id: '',
  description: '',
  players: '',
  time: '',
  materials: '',
  rules: '',
  example: '',
};

export default function AddEditGame() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [types, setTypes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const typesData = await api.getGameTypes();
        setTypes(typesData);

        if (isEdit) {
          const game = await api.getGame(id);
          setForm({
            title: game.title || '',
            type_id: game.type_id,
            description: game.description || '',
            players: game.players || '',
            time: game.time || '',
            materials: game.materials || '',
            rules: game.rules || '',
            example: game.example || '',
          });
        } else if (typesData.length) {
          setForm((f) => ({ ...f, type_id: typesData[0].id }));
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, isEdit]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.type_id) {
      setError('Title and game type are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await api.updateGame(id, form);
        navigate(-1);
      } else {
        const created = await api.createGame(form);
        navigate(`/games/${created.id}`);
      }
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await api.deleteGame(id);
      navigate('/games');
    } catch (err) {
      setError(err.message);
      setConfirmingDelete(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <PageHeader title={isEdit ? 'Edit Game' : 'Add Game'} backTo="history" />
        <p className="state-message">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title={isEdit ? 'Edit Game' : 'Add Game'}
        backTo="history"
        actions={
          isEdit && (
            <button className="icon-btn danger" onClick={() => setConfirmingDelete(true)} aria-label="Delete">
              <span className="material-symbols-outlined">delete</span>
            </button>
          )
        }
      />

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="title">Title *</label>
          <input
            id="title"
            type="text"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="e.g. Charades"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="type_id">Game Type *</label>
          <div className="select-wrap">
            <select id="type_id" value={form.type_id} onChange={(e) => update('type_id', e.target.value)} required>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <span className="select-chevron" aria-hidden="true">
              <span className="material-symbols-outlined">expand_more</span>
            </span>
          </div>
        </div>

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="A brief one or two sentence description"
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="players">Players</label>
            <input
              id="players"
              type="text"
              value={form.players}
              onChange={(e) => update('players', e.target.value)}
              placeholder="e.g. 3-6"
            />
          </div>
          <div className="field">
            <label htmlFor="time">Time</label>
            <input
              id="time"
              type="text"
              value={form.time}
              onChange={(e) => update('time', e.target.value)}
              placeholder="e.g. 10-20 min"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="materials">Materials</label>
          <input
            id="materials"
            type="text"
            value={form.materials}
            onChange={(e) => update('materials', e.target.value)}
            placeholder="e.g. Pen and paper"
          />
        </div>

        <div className="field">
          <label htmlFor="rules">Rules</label>
          <textarea
            id="rules"
            value={form.rules}
            onChange={(e) => update('rules', e.target.value)}
            placeholder="How to play"
            rows={6}
          />
        </div>

        <div className="field">
          <label htmlFor="example">Example</label>
          <textarea
            id="example"
            value={form.example}
            onChange={(e) => update('example', e.target.value)}
            placeholder="A sample round to make it concrete"
            rows={4}
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>
            Cancel
          </button>
          <button type="submit" className="btn btn-neutral" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>

      {confirmingDelete && (
        <ConfirmModal
          title={`Delete "${form.title}"?`}
          body="This can't be undone."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
