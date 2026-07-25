import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { api } from '../lib/api.js';
import { generateDefaultTypeColors } from '../lib/colors.js';

function TypeEditor({ initial, onSave, onCancel, saving }) {
  const [name, setName] = useState(initial?.name || '');
  const accent = initial?.accent || '#3A3A3A';
  const bg = initial?.bg || '#EFEFEF';
  const isProtected = initial?.protected;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="field">
        <label>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isProtected}
          placeholder="e.g. Word Games"
        />
      </div>
      <div className="form-actions">
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn btn-neutral btn-sm"
          disabled={saving || !name.trim()}
          onClick={() => onSave({ name, accent, bg })}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default function ManageTypes() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getGameTypes();
      setTypes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSaveNew(values) {
    setSaving(true);
    setError(null);
    try {
      await api.createGameType(values);
      setAdding(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id, values) {
    setSaving(true);
    setError(null);
    try {
      await api.updateGameType(id, values);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setError(null);
    try {
      await api.deleteGameType(id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const defaultColors = generateDefaultTypeColors(types.map((t) => t.accent));

  return (
    <div className="page">
      <PageHeader title="Edit Game Types" />

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <p className="state-message">Loading…</p>
      ) : (
        <>
          <div className="type-list">
            {types.map((t) =>
              editingId === t.id ? (
                <TypeEditor
                  key={t.id}
                  initial={t}
                  saving={saving}
                  onCancel={() => setEditingId(null)}
                  onSave={(values) => handleSaveEdit(t.id, values)}
                />
              ) : (
                <div className="type-list-item" key={t.id}>
                  <div className="type-list-item-name">{t.name}</div>
                  {t.protected && <span className="protected-badge">Protected</span>}
                  <div className="type-list-item-actions">
                    <button className="icon-btn" onClick={() => setEditingId(t.id)} aria-label="Edit">
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                    {!t.protected && (
                      <button
                        className="icon-btn danger"
                        onClick={() => setDeleteTarget(t)}
                        aria-label="Delete"
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            )}
          </div>

          {adding ? (
            <TypeEditor
              initial={defaultColors}
              saving={saving}
              onCancel={() => setAdding(false)}
              onSave={handleSaveNew}
            />
          ) : (
            <button className="btn btn-neutral btn-block" onClick={() => setAdding(true)}>
              <span className="material-symbols-outlined">add</span>
              Add Game Type
            </button>
          )}
        </>
      )}

      {deleteTarget && (
        <ConfirmModal
          title={`Delete "${deleteTarget.name}"?`}
          body="Games of this type will be reassigned to Unassigned, not deleted."
          confirmLabel="Delete"
          onConfirm={() => handleDelete(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
