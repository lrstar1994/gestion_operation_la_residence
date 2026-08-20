import { useEffect, useMemo, useState } from 'react'
import { Edit2, Plus, Trash2, UserRoundCog, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  creerDomaineExecutant,
  creerExecutant,
  listerDomainesExecutants,
  listerExecutants,
  modifierDomaineExecutant,
  modifierExecutant,
  supprimerExecutant,
  type DomaineExecutant,
  type Executant,
} from '../api/executants'
import { useAuth } from '../hooks/useAuth'

type FormulaireExecutant = {
  id: string | null
  nom: string
  id_domaine: string
}

type FormulaireDomaine = {
  id: string | null
  nom: string
  capacite_max: string
}

const formulaireInitial: FormulaireExecutant = {
  id: null,
  nom: '',
  id_domaine: '',
}

const formulaireDomaineInitial: FormulaireDomaine = {
  id: null,
  nom: '',
  capacite_max: '',
}

export function GestionExecutants() {
  const [domaines, setDomaines] = useState<DomaineExecutant[]>([])
  const [executants, setExecutants] = useState<Executant[]>([])
  const [formulaire, setFormulaire] = useState<FormulaireExecutant>(formulaireInitial)
  const [chargement, setChargement] = useState(true)
  const [soumission, setSoumission] = useState(false)
  const [actionEnCours, setActionEnCours] = useState<string | null>(null)
  const [formulaireDomaine, setFormulaireDomaine] = useState<FormulaireDomaine>(formulaireDomaineInitial)
  const [soumissionDomaine, setSoumissionDomaine] = useState(false)
  const { estAdmin, peutAccederAuDomaine } = useAuth()

  const peutModifier = estAdmin() || peutAccederAuDomaine('chambres') || peutAccederAuDomaine('salles')

  const executantsParDomaine = useMemo(
    () =>
      domaines.map((domaine) => ({
        domaine,
        executants: executants.filter((executant) => executant.id_domaine === domaine.id),
      })),
    [domaines, executants],
  )

  async function chargerDonnees() {
    setChargement(true)

    try {
      const [domainesResultat, executantsResultat] = await Promise.all([
        listerDomainesExecutants(),
        listerExecutants(),
      ])

      setDomaines(domainesResultat)
      setExecutants(executantsResultat)
      setFormulaire((etat) => ({
        ...etat,
        id_domaine: etat.id_domaine || domainesResultat[0]?.id || '',
      }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Executants impossibles a charger.')
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    void chargerDonnees()
  }, [])

  function reinitialiserFormulaire() {
    setFormulaire({
      ...formulaireInitial,
      id_domaine: domaines[0]?.id || '',
    })
  }

  function modifierLigne(executant: Executant) {
    setFormulaire({
      id: executant.id,
      nom: executant.nom,
      id_domaine: executant.id_domaine,
    })
  }

  async function gererSoumission(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!peutModifier) {
      toast.error("Vous n'avez pas le droit de modifier les executants.")
      return
    }

    if (formulaire.nom.trim().length < 2) {
      toast.error('Le nom doit contenir au moins 2 caracteres.')
      return
    }

    if (!formulaire.id_domaine) {
      toast.error('Veuillez choisir un domaine.')
      return
    }

    setSoumission(true)

    try {
      const payload = {
        nom: formulaire.nom.trim(),
        id_domaine: formulaire.id_domaine,
      }

      if (formulaire.id) {
        const executant = await modifierExecutant(formulaire.id, payload)
        setExecutants((liste) => liste.map((item) => (item.id === executant.id ? executant : item)))
        toast.success('Executant modifie.')
      } else {
        const executant = await creerExecutant(payload)
        setExecutants((liste) => [...liste, executant].sort((a, b) => a.nom.localeCompare(b.nom)))
        toast.success('Executant ajoute.')
      }

      reinitialiserFormulaire()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.')
    } finally {
      setSoumission(false)
    }
  }

  async function gererSuppression(executant: Executant) {
    const confirme = window.confirm(
      `Confirmer la suppression de ${executant.nom} ? Cette action est definitive.`,
    )

    if (!confirme) {
      return
    }

    setActionEnCours(executant.id)

    try {
      await supprimerExecutant(executant.id)
      setExecutants((liste) => liste.filter((item) => item.id !== executant.id))
      toast.success('Executant supprime.')

      if (formulaire.id === executant.id) {
        reinitialiserFormulaire()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.')
    } finally {
      setActionEnCours(null)
    }
  }

  function reinitialiserFormulaireDomaine() {
    setFormulaireDomaine(formulaireDomaineInitial)
  }

  function modifierDomaine(domaine: DomaineExecutant) {
    setFormulaireDomaine({
      id: domaine.id,
      nom: domaine.nom,
      capacite_max: domaine.capacite_max?.toString() || '',
    })
  }

  async function gererSoumissionDomaine(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!estAdmin()) {
      toast.error("Seul l'admin peut gérer les domaines.")
      return
    }

    const nom = formulaireDomaine.nom.trim()
    const capacite = convertirCapacite(formulaireDomaine.capacite_max)

    if (nom.length < 2) {
      toast.error('Le nom du domaine doit contenir au moins 2 caracteres.')
      return
    }

    if (capacite === false) {
      toast.error('La capacite doit etre un nombre entier positif, ou vide pour illimite.')
      return
    }

    setSoumissionDomaine(true)

    try {
      if (formulaireDomaine.id) {
        const domaine = await modifierDomaineExecutant(formulaireDomaine.id, { capacite_max: capacite })
        setDomaines((liste) => liste.map((item) => (item.id === domaine.id ? domaine : item)))
        setExecutants((liste) => liste.map((executant) => (
          executant.id_domaine === domaine.id
            ? { ...executant, domaine }
            : executant
        )))
        toast.success('Domaine executant modifie.')
      } else {
        const domaine = await creerDomaineExecutant({ nom, capacite_max: capacite })
        setDomaines((liste) => [...liste, domaine].sort((a, b) => a.nom.localeCompare(b.nom)))
        setFormulaire((etat) => ({ ...etat, id_domaine: etat.id_domaine || domaine.id }))
        toast.success('Domaine executant ajoute.')
      }
      reinitialiserFormulaireDomaine()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement du domaine impossible.')
    } finally {
      setSoumissionDomaine(false)
    }
  }

  return (
    <section>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Gestion des executants</h1>
          <p className="mt-1 text-sm text-slate-500">Personnel rattache aux domaines chambre, salle et maintenance.</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <UserRoundCog className="h-5 w-5" />
        </div>
      </div>

      {estAdmin() && (
        <div className="mb-5 grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <form onSubmit={gererSoumissionDomaine} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-950">
                  {formulaireDomaine.id ? 'Modifier un domaine executant' : 'Ajouter un domaine executant'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">En modification, seul la capacite max est modifiable.</p>
              </div>
              {formulaireDomaine.id && (
                <button
                  type="button"
                  onClick={reinitialiserFormulaireDomaine}
                  className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label="Annuler la modification"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <label className="mb-4 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Nom</span>
              <input
                type="text"
                value={formulaireDomaine.nom}
                disabled={Boolean(formulaireDomaine.id)}
                onChange={(event) => setFormulaireDomaine((etat) => ({ ...etat, nom: event.target.value }))}
                placeholder="ex: femme de chambre"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
              />
            </label>

            <label className="mb-5 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Capacite max</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={formulaireDomaine.capacite_max}
                onChange={(event) => setFormulaireDomaine((etat) => ({ ...etat, capacite_max: event.target.value }))}
                placeholder="Vide = illimite"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
            </label>

            <button
              type="submit"
              disabled={soumissionDomaine}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {soumissionDomaine ? 'Enregistrement...' : formulaireDomaine.id ? 'Enregistrer' : 'Ajouter le domaine'}
            </button>
          </form>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="mb-4">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-base font-semibold text-slate-950">Domaines executants</h2>
                <p className="mt-1 text-sm text-slate-500">Les noms existants ne sont pas modifiables. Vide = capacite illimitee.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Nom</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Capacite max</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {domaines.map((domaine) => (
                    <tr key={domaine.id} className={formulaireDomaine.id === domaine.id ? 'bg-teal-50/60' : 'bg-white'}>
                      <td className="px-4 py-3 font-medium text-slate-900">{domaine.nom}</td>
                      <td className="px-4 py-3 text-slate-600">{domaine.capacite_max ?? 'Illimite'}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => modifierDomaine(domaine)}
                          className="rounded-md p-2 text-slate-500 hover:bg-teal-50 hover:text-teal-700"
                          aria-label="Modifier le domaine"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {domaines.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500">Aucun domaine executant.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <form onSubmit={gererSoumission} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-950">
              {formulaire.id ? 'Modifier un executant' : 'Ajouter un executant'}
            </h2>
            {formulaire.id && (
              <button
                type="button"
                onClick={reinitialiserFormulaire}
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Annuler la modification"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <label className="mb-4 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Nom</span>
            <input
              type="text"
              value={formulaire.nom}
              disabled={!peutModifier}
              onChange={(event) => setFormulaire((etat) => ({ ...etat, nom: event.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
            />
          </label>

          <label className="mb-5 block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Domaine</span>
            <select
              value={formulaire.id_domaine}
              disabled={!peutModifier || domaines.length === 0}
              onChange={(event) => setFormulaire((etat) => ({ ...etat, id_domaine: event.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100 disabled:bg-slate-100"
            >
              {domaines.map((domaine) => (
                <option key={domaine.id} value={domaine.id}>
                  {domaine.nom}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={!peutModifier || soumission || domaines.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {soumission ? 'Enregistrement...' : formulaire.id ? 'Enregistrer' : 'Ajouter'}
          </button>
        </form>

        <div className="space-y-4">
          {chargement && (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              Chargement...
            </div>
          )}

          {!chargement &&
            executantsParDomaine.map(({ domaine, executants: liste }) => (
              <div key={domaine.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-slate-950">{domaine.nom}</h2>
                    <p className="text-xs text-slate-500">
                      {domaine.capacite_max ? `Capacite max : ${domaine.capacite_max}` : 'Pas de limite definie'}
                    </p>
                  </div>
                  <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    {liste.length}
                  </span>
                </div>

                {liste.length > 0 ? (
                  <ul className="divide-y divide-slate-200">
                    {liste.map((executant) => (
                      <li key={executant.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="min-w-0 break-words font-medium text-slate-800">{executant.nom}</span>
                        <div className="flex items-center gap-1">
                          {peutModifier && (
                            <button
                              type="button"
                              onClick={() => modifierLigne(executant)}
                              className="rounded-md p-2 text-slate-500 hover:bg-teal-50 hover:text-teal-700"
                              aria-label="Modifier"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {estAdmin() && (
                            <button
                              type="button"
                              disabled={actionEnCours === executant.id}
                              onClick={() => void gererSuppression(executant)}
                              className="rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                              aria-label="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-6 text-sm text-slate-500">Aucun executant dans ce domaine.</div>
                )}
              </div>
            ))}

          {!chargement && domaines.length === 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              Aucun domaine executant. Executez le fichier SQL avant d'utiliser cet ecran.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function convertirCapacite(valeur: string): number | null | false {
  const texte = valeur.trim()
  if (texte === '') return null

  const nombre = Number(texte)
  if (!Number.isInteger(nombre) || nombre < 0) return false

  return nombre
}
