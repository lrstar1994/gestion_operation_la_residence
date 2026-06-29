import { useEffect, useState } from 'react'
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  creerTypeMouvement,
  listerTypesMouvement,
  modifierTypeMouvement,
  supprimerTypeMouvement,
  type TypeMouvement,
} from '../api/planningChambre'

export function GestionTypesMouvement() {
  const [types, setTypes] = useState<TypeMouvement[]>([])
  const [chargement, setChargement] = useState(true)
  const [edition, setEdition] = useState<TypeMouvement | null>(null)
  const [nom, setNom] = useState('')
  const [points, setPoints] = useState(0)
  const [soumission, setSoumission] = useState(false)

  useEffect(() => {
    void charger()
  }, [])

  async function charger() {
    setChargement(true)

    try {
      setTypes(await listerTypesMouvement())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Chargement impossible.')
    } finally {
      setChargement(false)
    }
  }

  function reinitialiser() {
    setEdition(null)
    setNom('')
    setPoints(0)
  }

  function commencerEdition(type: TypeMouvement) {
    setEdition(type)
    setNom(type.nom)
    setPoints(type.points)
  }

  async function enregistrer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nomNettoye = nom.trim().toUpperCase()

    if (!nomNettoye) {
      toast.error('Le nom est obligatoire.')
      return
    }

    if (!Number.isFinite(points) || points < 0) {
      toast.error('Les points doivent etre superieurs ou egaux a 0.')
      return
    }

    setSoumission(true)

    try {
      const payload = { nom: nomNettoye, points }
      const type = edition ? await modifierTypeMouvement(edition.id, payload) : await creerTypeMouvement(payload)

      setTypes((liste) => {
        const map = new Map(liste.map((item) => [item.id, item]))
        map.set(type.id, type)
        return Array.from(map.values()).sort((a, b) => a.nom.localeCompare(b.nom))
      })
      reinitialiser()
      toast.success(edition ? 'Type de mouvement modifie.' : 'Type de mouvement cree.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.')
    } finally {
      setSoumission(false)
    }
  }

  async function supprimer(type: TypeMouvement) {
    if (!window.confirm(`Supprimer le type ${type.nom} ?`)) return

    try {
      await supprimerTypeMouvement(type.id)
      setTypes((liste) => liste.filter((item) => item.id !== type.id))
      if (edition?.id === type.id) reinitialiser()
      toast.success('Type de mouvement supprime.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible. Ce type est peut-etre deja utilise.')
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Types de mouvement</h1>
        <p className="mt-1 text-sm text-slate-500">Gestion admin des mouvements et des points associes.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <form onSubmit={enregistrer} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            {edition ? <Pencil className="h-4 w-4 text-teal-700" /> : <Plus className="h-4 w-4 text-teal-700" />}
            <h2 className="font-semibold text-slate-950">{edition ? 'Modifier' : 'Ajouter'} un type</h2>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Nom</span>
            <input
              value={nom}
              onChange={(event) => setNom(event.target.value)}
              placeholder="DEPART"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Points</span>
            <input
              type="number"
              min={0}
              value={points}
              onChange={(event) => setPoints(Number(event.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {edition && (
              <button type="button" onClick={reinitialiser} className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <X className="h-4 w-4" />
                Annuler
              </button>
            )}
            <button type="submit" disabled={soumission} className="inline-flex items-center justify-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
              <Save className="h-4 w-4" />
              Enregistrer
            </button>
          </div>
        </form>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="font-semibold text-slate-950">Liste des types</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[520px] w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Nom</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Points</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {chargement && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">Chargement...</td>
                  </tr>
                )}
                {!chargement && types.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">Aucun type de mouvement.</td>
                  </tr>
                )}
                {!chargement && types.map((type) => (
                  <tr key={type.id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{type.nom}</td>
                    <td className="px-4 py-3 text-slate-600">{type.points} pts</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => commencerEdition(type)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100" aria-label="Modifier">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => void supprimer(type)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50" aria-label="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
