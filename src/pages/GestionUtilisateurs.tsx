import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Trash2, Users } from 'lucide-react'
import {
  DOMAINES,
  listerUtilisateurs,
  mettreAJourUtilisateur,
  supprimerUtilisateur,
  type DomaineOperation,
  type ProfilUtilisateur,
  type RoleUtilisateur,
} from '../api/auth'

export function GestionUtilisateurs() {
  const [utilisateurs, setUtilisateurs] = useState<ProfilUtilisateur[]>([])
  const [chargement, setChargement] = useState(true)
  const [actionEnCours, setActionEnCours] = useState<string | null>(null)

  async function chargerUtilisateurs() {
    setChargement(true)

    try {
      setUtilisateurs(await listerUtilisateurs())
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Utilisateurs impossibles a charger.')
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    void chargerUtilisateurs()
  }, [])

  async function mettreAJour(id: string, valeurs: Partial<ProfilUtilisateur>) {
    setActionEnCours(id)

    try {
      const utilisateur = await mettreAJourUtilisateur(id, valeurs)
      setUtilisateurs((liste) => liste.map((item) => (item.id === id ? utilisateur : item)))
      toast.success('Utilisateur mis a jour.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Mise a jour impossible.')
    } finally {
      setActionEnCours(null)
    }
  }

  async function changerRole(utilisateur: ProfilUtilisateur, role: RoleUtilisateur) {
    await mettreAJour(utilisateur.id, {
      role,
      domaines_autorises: role === 'admin' ? [] : utilisateur.domaines_autorises,
    })
  }

  async function changerDomaine(utilisateur: ProfilUtilisateur, domaine: DomaineOperation, coche: boolean) {
    const domaines = coche
      ? Array.from(new Set([...utilisateur.domaines_autorises, domaine]))
      : utilisateur.domaines_autorises.filter((item) => item !== domaine)

    await mettreAJour(utilisateur.id, { domaines_autorises: domaines })
  }

  async function gererSuppression(utilisateur: ProfilUtilisateur) {
    const confirme = window.confirm(`Supprimer le profil de ${utilisateur.nom} ?`)

    if (!confirme) {
      return
    }

    setActionEnCours(utilisateur.id)

    try {
      await supprimerUtilisateur(utilisateur.id)
      setUtilisateurs((liste) => liste.filter((item) => item.id !== utilisateur.id))
      toast.success('Utilisateur supprime.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.')
    } finally {
      setActionEnCours(null)
    }
  }

  return (
    <section>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Gestion des utilisateurs</h1>
          <p className="mt-1 text-sm text-slate-500">Validation, roles et domaines autorises.</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <Users className="h-5 w-5" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Utilisateur</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-500">Domaines</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {chargement && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Chargement...
                  </td>
                </tr>
              )}

              {!chargement &&
                utilisateurs.map((utilisateur) => (
                  <tr key={utilisateur.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{utilisateur.nom}</p>
                      <p className="text-sm text-slate-500">{utilisateur.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        disabled={actionEnCours === utilisateur.id}
                        onClick={() =>
                          void mettreAJour(utilisateur.id, {
                            statut: utilisateur.statut === 1 ? 0 : 1,
                          })
                        }
                        className={[
                          'rounded-md px-3 py-1 text-sm font-semibold',
                          utilisateur.statut === 1
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700',
                        ].join(' ')}
                      >
                        {utilisateur.statut === 1 ? 'Actif' : 'Inactif'}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={utilisateur.role}
                        disabled={actionEnCours === utilisateur.id}
                        onChange={(event) => void changerRole(utilisateur, event.target.value as RoleUtilisateur)}
                        className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                      >
                        <option value="coordinateur">Coordinateur</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      {utilisateur.role === 'coordinateur' ? (
                        <div className="flex flex-wrap gap-3">
                          {DOMAINES.map((domaine) => (
                            <label key={domaine} className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={utilisateur.domaines_autorises.includes(domaine)}
                                disabled={actionEnCours === utilisateur.id}
                                onChange={(event) => void changerDomaine(utilisateur, domaine, event.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                              />
                              {domaine}
                            </label>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-500">Tous les domaines</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        disabled={actionEnCours === utilisateur.id}
                        onClick={() => void gererSuppression(utilisateur)}
                        className="inline-flex items-center justify-center rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}

              {!chargement && utilisateurs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">
                    Aucun utilisateur.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
