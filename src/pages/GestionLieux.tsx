import { useEffect, useMemo, useState } from 'react'
import { Building2, ChevronLeft, ChevronRight, Edit2, Layers3, List, MapPin, Plus, Search, Trash2, TreePine, X } from 'lucide-react'
import { toast } from 'sonner'
import { listerExecutants, type Executant } from '../api/executants'
import {
  creerBatiment,
  creerCategorieLieu,
  creerLieu,
  listerBatiments,
  listerCategoriesLieu,
  listerLieux,
  modifierBatiment,
  modifierCategorieLieu,
  modifierLieu,
  supprimerBatiment,
  supprimerCategorieLieu,
  supprimerLieu,
  type Batiment,
  type CategorieLieu,
  type Lieu,
} from '../api/lieux'
import { useAuth } from '../hooks/useAuth'

type VueLieux = 'arbre' | 'liste'
type FormulaireActif = 'lieu' | 'batiment' | 'categorie'

type FormLieu = {
  id: string | null
  nom: string
  code: string
  id_batiment: string
  id_categorie: string
  numero: string
  est_actif: boolean
}

type FormSimple = {
  id: string | null
  code: string
  nom: string
  id_executant_defaut?: string
}

const formLieuInitial: FormLieu = {
  id: null,
  nom: '',
  code: '',
  id_batiment: '',
  id_categorie: '',
  numero: '',
  est_actif: true,
}

const formSimpleInitial: FormSimple = {
  id: null,
  code: '',
  nom: '',
}

export function GestionLieux() {
  const [batiments, setBatiments] = useState<Batiment[]>([])
  const [categories, setCategories] = useState<CategorieLieu[]>([])
  const [lieux, setLieux] = useState<Lieu[]>([])
  const [executants, setExecutants] = useState<Executant[]>([])
  const [chargement, setChargement] = useState(true)
  const [soumission, setSoumission] = useState(false)
  const [actionEnCours, setActionEnCours] = useState<string | null>(null)
  const [vue, setVue] = useState<VueLieux>('arbre')
  const [formulaireActif, setFormulaireActif] = useState<FormulaireActif>('lieu')
  const [formLieu, setFormLieu] = useState<FormLieu>(formLieuInitial)
  const [formBatiment, setFormBatiment] = useState<FormSimple>(formSimpleInitial)
  const [formCategorie, setFormCategorie] = useState<FormSimple>(formSimpleInitial)
  const [recherche, setRecherche] = useState('')
  const [filtreBatiment, setFiltreBatiment] = useState('tous')
  const [filtreCategorie, setFiltreCategorie] = useState('tous')
  const [filtreStatut, setFiltreStatut] = useState('actifs')
  const [indexGroupe, setIndexGroupe] = useState(0)
  const [pageListe, setPageListe] = useState(1)
  const [lignesParPage, setLignesParPage] = useState(25)
  const { estAdmin } = useAuth()

  const lectureSeule = !estAdmin()

  const lieuxFiltres = useMemo(() => {
    const rechercheNormalisee = recherche.trim().toLowerCase()

    return lieux.filter((lieu) => {
      const texte = [lieu.nom, lieu.code, lieu.numero, lieu.batiment?.nom, lieu.batiment?.code, lieu.categorie?.nom]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (rechercheNormalisee && !texte.includes(rechercheNormalisee)) {
        return false
      }

      if (filtreBatiment !== 'tous') {
        if (filtreBatiment === 'sans-batiment' && lieu.id_batiment) {
          return false
        }

        if (filtreBatiment !== 'sans-batiment' && lieu.id_batiment !== filtreBatiment) {
          return false
        }
      }

      if (filtreCategorie !== 'tous' && lieu.id_categorie !== filtreCategorie) {
        return false
      }

      if (filtreStatut === 'actifs' && !lieu.est_actif) {
        return false
      }

      if (filtreStatut === 'inactifs' && lieu.est_actif) {
        return false
      }

      return true
    })
  }, [filtreBatiment, filtreCategorie, filtreStatut, lieux, recherche])

  const lieuxParBatiment = useMemo(() => {
    const groupes = [
      ...batiments.map((batiment) => ({
        id: batiment.id,
        titre: batiment.nom,
        sousTitre: batiment.code,
        executantDefaut: batiment.executant_defaut?.nom || null,
        lieux: lieuxFiltres.filter((lieu) => lieu.id_batiment === batiment.id),
      })),
      {
        id: 'sans-batiment',
        titre: 'Espaces sans batiment',
        sousTitre: 'Communs et techniques',
        executantDefaut: null,
        lieux: lieuxFiltres.filter((lieu) => !lieu.id_batiment),
      },
    ]

    return groupes.filter((groupe) => groupe.lieux.length > 0)
  }, [batiments, lieuxFiltres])

  const statistiques = useMemo(
    () => ({
      total: lieuxFiltres.length,
      actifs: lieuxFiltres.filter((lieu) => lieu.est_actif).length,
      chambres: lieuxFiltres.filter((lieu) => lieu.categorie?.code === 'chambre').length,
      batiments: lieuxParBatiment.length,
    }),
    [lieuxFiltres, lieuxParBatiment.length],
  )

  const groupesAffiches = useMemo(() => {
    if (filtreBatiment !== 'tous') {
      return lieuxParBatiment
    }

    return lieuxParBatiment[indexGroupe] ? [lieuxParBatiment[indexGroupe]] : []
  }, [filtreBatiment, indexGroupe, lieuxParBatiment])

  const totalPagesListe = Math.max(1, Math.ceil(lieuxFiltres.length / lignesParPage))
  const lieuxListePage = useMemo(() => {
    const debut = (pageListe - 1) * lignesParPage
    return lieuxFiltres.slice(debut, debut + lignesParPage)
  }, [lieuxFiltres, lignesParPage, pageListe])

  useEffect(() => {
    setIndexGroupe(0)
    setPageListe(1)
  }, [filtreBatiment, filtreCategorie, filtreStatut, recherche])

  useEffect(() => {
    if (indexGroupe > Math.max(lieuxParBatiment.length - 1, 0)) {
      setIndexGroupe(Math.max(lieuxParBatiment.length - 1, 0))
    }
  }, [indexGroupe, lieuxParBatiment.length])

  useEffect(() => {
    if (pageListe > totalPagesListe) {
      setPageListe(totalPagesListe)
    }
  }, [pageListe, totalPagesListe])

  async function chargerDonnees() {
    setChargement(true)

    try {
      const [batimentsResultat, categoriesResultat, lieuxResultat, executantsResultat] = await Promise.all([
        listerBatiments(),
        listerCategoriesLieu(),
        listerLieux(),
        listerExecutants(),
      ])

      setBatiments(batimentsResultat)
      setCategories(categoriesResultat)
      setLieux(lieuxResultat)
      setExecutants(executantsResultat)
      setFormLieu((etat) => ({
        ...etat,
        id_categorie: etat.id_categorie || categoriesResultat[0]?.id || '',
      }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Lieux impossibles a charger.')
    } finally {
      setChargement(false)
    }
  }

  useEffect(() => {
    void chargerDonnees()
  }, [])

  function reinitialiserFormulaires() {
    setFormLieu({ ...formLieuInitial, id_categorie: categories[0]?.id || '' })
    setFormBatiment(formSimpleInitial)
    setFormCategorie(formSimpleInitial)
  }

  function editerLieu(lieu: Lieu) {
    setFormulaireActif('lieu')
    setFormLieu({
      id: lieu.id,
      nom: lieu.nom,
      code: lieu.code || '',
      id_batiment: lieu.id_batiment || '',
      id_categorie: lieu.id_categorie,
      numero: lieu.numero || '',
      est_actif: lieu.est_actif,
    })
  }

  function editerBatiment(batiment: Batiment) {
    setFormulaireActif('batiment')
    setFormBatiment({
      id: batiment.id,
      code: batiment.code,
      nom: batiment.nom,
      id_executant_defaut: batiment.id_executant_defaut || '',
    })
  }

  function editerCategorie(categorie: CategorieLieu) {
    setFormulaireActif('categorie')
    setFormCategorie({ id: categorie.id, code: categorie.code, nom: categorie.nom })
  }

  async function gererLieu(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!validerAdmin()) {
      return
    }

    if (formLieu.nom.trim().length < 2 || !formLieu.id_categorie) {
      toast.error('Le nom et la categorie sont obligatoires.')
      return
    }

    setSoumission(true)

    try {
      const payload = {
        nom: formLieu.nom.trim(),
        code: formLieu.code.trim() || null,
        id_batiment: formLieu.id_batiment || null,
        id_categorie: formLieu.id_categorie,
        numero: formLieu.numero.trim() || null,
        est_actif: formLieu.est_actif,
      }

      if (formLieu.id) {
        const lieu = await modifierLieu(formLieu.id, payload)
        setLieux((liste) => liste.map((item) => (item.id === lieu.id ? lieu : item)))
        toast.success('Lieu modifie.')
      } else {
        const lieu = await creerLieu(payload)
        setLieux((liste) => [...liste, lieu].sort((a, b) => a.nom.localeCompare(b.nom)))
        toast.success('Lieu cree.')
      }

      reinitialiserFormulaires()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.')
    } finally {
      setSoumission(false)
    }
  }

  async function gererBatiment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await gererSimple(
      formBatiment,
      creerBatiment,
      modifierBatiment,
      (item) => setBatiments((liste) => upsertListe(liste, item)),
      'Batiment',
    )
  }

  async function gererCategorie(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await gererSimple(
      formCategorie,
      creerCategorieLieu,
      modifierCategorieLieu,
      (item) => setCategories((liste) => upsertListe(liste, item)),
      'Categorie',
    )
  }

  async function gererSimple<T extends { id: string; code: string; nom: string }>(
    formulaire: FormSimple,
    creer: (payload: { code: string; nom: string }) => Promise<T>,
    modifier: (id: string, payload: { code: string; nom: string }) => Promise<T>,
    maj: (item: T) => void,
    libelle: string,
  ) {
    if (!validerAdmin()) {
      return
    }

    if (formulaire.code.trim().length < 2 || formulaire.nom.trim().length < 2) {
      toast.error('Le code et le nom sont obligatoires.')
      return
    }

    setSoumission(true)

    try {
      const payload = {
        code: formulaire.code.trim().toUpperCase(),
        nom: formulaire.nom.trim(),
        ...(formulaireActif === 'batiment'
          ? { id_executant_defaut: formulaire.id_executant_defaut || null }
          : {}),
      }
      const item = formulaire.id ? await modifier(formulaire.id, payload) : await creer(payload)

      maj(item)
      reinitialiserFormulaires()
      toast.success(`${libelle} enregistre.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Enregistrement impossible.')
    } finally {
      setSoumission(false)
    }
  }

  async function gererSuppressionLieu(lieu: Lieu) {
    if (!window.confirm(`Supprimer ${afficherLieu(lieu)} ?`)) {
      return
    }

    await supprimerElement(lieu.id, supprimerLieu, () => setLieux((liste) => liste.filter((item) => item.id !== lieu.id)))
  }

  async function gererSuppressionBatiment(batiment: Batiment) {
    if (!window.confirm(`Supprimer ${batiment.nom} ? Les lieux rattaches passeront sans batiment.`)) {
      return
    }

    await supprimerElement(batiment.id, supprimerBatiment, () => {
      setBatiments((liste) => liste.filter((item) => item.id !== batiment.id))
      setLieux((liste) => liste.map((lieu) => (lieu.id_batiment === batiment.id ? { ...lieu, id_batiment: null, batiment: null } : lieu)))
    })
  }

  async function gererSuppressionCategorie(categorie: CategorieLieu) {
    if (!window.confirm(`Supprimer la categorie ${categorie.nom} ?`)) {
      return
    }

    await supprimerElement(categorie.id, supprimerCategorieLieu, () =>
      setCategories((liste) => liste.filter((item) => item.id !== categorie.id)),
    )
  }

  async function supprimerElement(id: string, supprimer: (id: string) => Promise<void>, maj: () => void) {
    if (!validerAdmin()) {
      return
    }

    setActionEnCours(id)

    try {
      await supprimer(id)
      maj()
      toast.success('Suppression effectuee.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Suppression impossible.')
    } finally {
      setActionEnCours(null)
    }
  }

  function validerAdmin() {
    if (lectureSeule) {
      toast.error('Seul un admin peut modifier les lieux.')
      return false
    }

    return true
  }

  return (
    <section>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Gestion des lieux</h1>
          <p className="mt-1 text-sm text-slate-500">Batiments, chambres, espaces communs et zones techniques.</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          <MapPin className="h-5 w-5" />
        </div>
      </div>

      <div className={lectureSeule ? 'grid gap-5' : 'grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]'}>
        {!lectureSeule && (
          <aside className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 grid grid-cols-3 gap-1 rounded-md bg-slate-100 p-1">
                <TabButton actif={formulaireActif === 'lieu'} onClick={() => setFormulaireActif('lieu')} label="Lieu" />
                <TabButton actif={formulaireActif === 'batiment'} onClick={() => setFormulaireActif('batiment')} label="Batiment" />
                <TabButton actif={formulaireActif === 'categorie'} onClick={() => setFormulaireActif('categorie')} label="Categorie" />
              </div>

              {formulaireActif === 'lieu' && (
                <FormLieu
                  form={formLieu}
                  batiments={batiments}
                  categories={categories}
                  soumission={soumission}
                  onSubmit={gererLieu}
                  onReset={reinitialiserFormulaires}
                  setForm={setFormLieu}
                />
              )}

              {formulaireActif === 'batiment' && (
                <FormSimple
                  titre={formBatiment.id ? 'Modifier un batiment' : 'Ajouter un batiment'}
                  form={formBatiment}
                  soumission={soumission}
                  executants={executants}
                  onSubmit={gererBatiment}
                  onReset={reinitialiserFormulaires}
                  setForm={setFormBatiment}
                />
              )}

              {formulaireActif === 'categorie' && (
                <FormSimple
                  titre={formCategorie.id ? 'Modifier une categorie' : 'Ajouter une categorie'}
                  form={formCategorie}
                  soumission={soumission}
                  onSubmit={gererCategorie}
                  onReset={reinitialiserFormulaires}
                  setForm={setFormCategorie}
                />
              )}
            </div>

            <Referentiels
              batiments={batiments}
              categories={categories}
              actionEnCours={actionEnCours}
              onEditBatiment={editerBatiment}
              onDeleteBatiment={gererSuppressionBatiment}
              onEditCategorie={editerCategorie}
              onDeleteCategorie={gererSuppressionCategorie}
            />
          </aside>
        )}

        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-white px-4 py-4">


            <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
              <div className="flex items-center gap-2">
                <Layers3 className="h-4 w-4 text-teal-700" />
                <h2 className="font-semibold text-slate-950">{lieuxFiltres.length} lieu(x)</h2>
              </div>

              <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(180px,1.4fr)_minmax(130px,1fr)_minmax(150px,1fr)_minmax(120px,0.8fr)_minmax(160px,auto)]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={recherche}
                    onChange={(event) => setRecherche(event.target.value)}
                    className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                    placeholder="Nom, numero, batiment..."
                  />
                </label>

                <FiltreSelect value={filtreBatiment} onChange={setFiltreBatiment}>
                  <option value="tous">Tous batiments</option>
                  <option value="sans-batiment">Sans batiment</option>
                  {batiments.map((batiment) => (
                    <option key={batiment.id} value={batiment.id}>
                      {batiment.nom}
                    </option>
                  ))}
                </FiltreSelect>

                <FiltreSelect value={filtreCategorie} onChange={setFiltreCategorie}>
                  <option value="tous">Toutes categories</option>
                  {categories.map((categorie) => (
                    <option key={categorie.id} value={categorie.id}>
                      {categorie.nom}
                    </option>
                  ))}
                </FiltreSelect>

                <FiltreSelect value={filtreStatut} onChange={setFiltreStatut}>
                  <option value="tous">Tous statuts</option>
                  <option value="actifs">Actifs</option>
                  <option value="inactifs">Inactifs</option>
                </FiltreSelect>

                <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1">
                  <VueButton actif={vue === 'arbre'} onClick={() => setVue('arbre')} icon={TreePine} label="Arbre" />
                  <VueButton actif={vue === 'liste'} onClick={() => setVue('liste')} icon={List} label="Liste" />
                </div>
              </div>
            </div>

            {vue === 'arbre' && filtreBatiment === 'tous' && lieuxParBatiment.length > 0 && (
              <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-slate-500">Pagination par batiment</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                    {lieuxParBatiment[indexGroupe]?.titre} ({indexGroupe + 1}/{lieuxParBatiment.length})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIndexGroupe((index) => Math.max(index - 1, 0))}
                    disabled={indexGroupe === 0}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Batiment precedent"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <select
                    value={indexGroupe}
                    onChange={(event) => setIndexGroupe(Number(event.target.value))}
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                  >
                    {lieuxParBatiment.map((groupe, index) => (
                      <option key={groupe.id} value={index}>
                        {groupe.titre}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setIndexGroupe((index) => Math.min(index + 1, lieuxParBatiment.length - 1))}
                    disabled={indexGroupe >= lieuxParBatiment.length - 1}
                    className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Batiment suivant"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {chargement ? (
            <div className="p-8 text-center text-sm text-slate-500">Chargement...</div>
          ) : vue === 'arbre' ? (
            <VueArborescente
              groupes={groupesAffiches}
              lectureSeule={lectureSeule}
              actionEnCours={actionEnCours}
              onEdit={editerLieu}
              onDelete={gererSuppressionLieu}
            />
          ) : (
            <>
              <PaginationListe
                page={pageListe}
                totalPages={totalPagesListe}
                totalItems={lieuxFiltres.length}
                lignesParPage={lignesParPage}
                onPageChange={setPageListe}
                onLignesParPageChange={(value) => {
                  setLignesParPage(value)
                  setPageListe(1)
                }}
              />
              <VueListe
                lieux={lieuxListePage}
                lectureSeule={lectureSeule}
                actionEnCours={actionEnCours}
                onEdit={editerLieu}
                onDelete={gererSuppressionLieu}
              />
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function FormLieu({
  form,
  batiments,
  categories,
  soumission,
  onSubmit,
  onReset,
  setForm,
}: {
  form: FormLieu
  batiments: Batiment[]
  categories: CategorieLieu[]
  soumission: boolean
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onReset: () => void
  setForm: React.Dispatch<React.SetStateAction<FormLieu>>
}) {
  return (
    <form onSubmit={onSubmit}>
      <FormHeader titre={form.id ? 'Modifier un lieu' : 'Ajouter un lieu'} onReset={form.id ? onReset : undefined} />
      <TextInput label="Nom" value={form.nom} onChange={(value) => setForm((etat) => ({ ...etat, nom: value }))} />
      <TextInput label="Code" value={form.code} onChange={(value) => setForm((etat) => ({ ...etat, code: value }))} />
      <TextInput label="Numero" value={form.numero} onChange={(value) => setForm((etat) => ({ ...etat, numero: value }))} />

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Batiment</span>
        <select
          value={form.id_batiment}
          onChange={(event) => setForm((etat) => ({ ...etat, id_batiment: event.target.value }))}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        >
          <option value="">Sans batiment</option>
          {batiments.map((batiment) => (
            <option key={batiment.id} value={batiment.id}>
              {batiment.nom}
            </option>
          ))}
        </select>
      </label>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Categorie</span>
        <select
          value={form.id_categorie}
          onChange={(event) => setForm((etat) => ({ ...etat, id_categorie: event.target.value }))}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        >
          {categories.map((categorie) => (
            <option key={categorie.id} value={categorie.id}>
              {categorie.nom}
            </option>
          ))}
        </select>
      </label>

      <label className="mb-5 flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={form.est_actif}
          onChange={(event) => setForm((etat) => ({ ...etat, est_actif: event.target.checked }))}
          className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
        />
        Actif
      </label>

      <SubmitButton loading={soumission} label={form.id ? 'Enregistrer' : 'Ajouter'} />
    </form>
  )
}

function FormSimple({
  titre,
  form,
  soumission,
  executants,
  onSubmit,
  onReset,
  setForm,
}: {
  titre: string
  form: FormSimple
  soumission: boolean
  executants?: Executant[]
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onReset: () => void
  setForm: React.Dispatch<React.SetStateAction<FormSimple>>
}) {
  return (
    <form onSubmit={onSubmit}>
      <FormHeader titre={titre} onReset={form.id ? onReset : undefined} />
      <TextInput label="Code" value={form.code} onChange={(value) => setForm((etat) => ({ ...etat, code: value }))} />
      <TextInput label="Nom" value={form.nom} onChange={(value) => setForm((etat) => ({ ...etat, nom: value }))} />
      {executants && (
        <label className="mb-5 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Executant par defaut</span>
          <select
            value={form.id_executant_defaut || ''}
            onChange={(event) => setForm((etat) => ({ ...etat, id_executant_defaut: event.target.value }))}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          >
            <option value="">Aucun</option>
            {executants.map((executant) => (
              <option key={executant.id} value={executant.id}>
                {executant.nom}
              </option>
            ))}
          </select>
        </label>
      )}
      <SubmitButton loading={soumission} label={form.id ? 'Enregistrer' : 'Ajouter'} />
    </form>
  )
}

function FormHeader({ titre, onReset }: { titre: string; onReset?: () => void }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <h2 className="font-semibold text-slate-950">{titre}</h2>
      {onReset && (
        <button type="button" onClick={onReset} className="rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label="Annuler">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
      />
    </label>
  )
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Plus className="h-4 w-4" />
      {loading ? 'Enregistrement...' : label}
    </button>
  )
}

function Referentiels({
  batiments,
  categories,
  actionEnCours,
  onEditBatiment,
  onDeleteBatiment,
  onEditCategorie,
  onDeleteCategorie,
}: {
  batiments: Batiment[]
  categories: CategorieLieu[]
  actionEnCours: string | null
  onEditBatiment: (batiment: Batiment) => void
  onDeleteBatiment: (batiment: Batiment) => void
  onEditCategorie: (categorie: CategorieLieu) => void
  onDeleteCategorie: (categorie: CategorieLieu) => void
}) {
  return (
    <div className="space-y-4">
      <MiniListe
        titre="Batiments"
        items={batiments}
        icon={Building2}
        actionEnCours={actionEnCours}
        onEdit={onEditBatiment}
        onDelete={onDeleteBatiment}
      />
      <MiniListe
        titre="Categories"
        items={categories}
        icon={Layers3}
        actionEnCours={actionEnCours}
        onEdit={onEditCategorie}
        onDelete={onDeleteCategorie}
      />
    </div>
  )
}

function MiniListe<T extends { id: string; code: string; nom: string }>({
  titre,
  items,
  icon: Icon,
  actionEnCours,
  onEdit,
  onDelete,
}: {
  titre: string
  items: T[]
  icon: typeof Building2
  actionEnCours: string | null
  onEdit: (item: T) => void
  onDelete: (item: T) => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
        <Icon className="h-4 w-4 text-teal-700" />
        <h2 className="font-semibold text-slate-950">{titre}</h2>
      </div>
      <ul className="max-h-60 space-y-2 overflow-y-auto p-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-800">{item.nom}</span>
              <span className="block truncate text-xs text-slate-400">{item.code}</span>
            </span>
            <Actions actionEnCours={actionEnCours === item.id} onEdit={() => onEdit(item)} onDelete={() => onDelete(item)} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function VueArborescente({
  groupes,
  lectureSeule,
  actionEnCours,
  onEdit,
  onDelete,
}: {
  groupes: Array<{ id: string; titre: string; sousTitre: string; executantDefaut: string | null; lieux: Lieu[] }>
  lectureSeule: boolean
  actionEnCours: string | null
  onEdit: (lieu: Lieu) => void
  onDelete: (lieu: Lieu) => void
}) {
  if (groupes.length === 0) {
    return <div className="p-8 text-center text-sm text-slate-500">Aucun lieu pour ces filtres.</div>
  }

  return (
    <div className="space-y-4 bg-slate-50 p-4">
      {groupes.map((groupe) => (
        <div key={groupe.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-100/70 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white text-teal-700 ring-1 ring-slate-200">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-slate-950">{groupe.titre}</h3>
                <p className="truncate text-xs text-slate-500">{groupe.sousTitre}</p>
                {groupe.executantDefaut && (
                  <p className="mt-1 truncate text-xs font-semibold text-teal-700">
                    Executant defaut : {groupe.executantDefaut}
                  </p>
                )}
              </div>
            </div>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{groupe.lieux.length}</span>
          </div>
          <div className="grid gap-3 p-3 sm:grid-cols-2 2xl:grid-cols-3">
            {groupe.lieux.map((lieu) => (
              <LieuCard
                key={lieu.id}
                lieu={lieu}
                lectureSeule={lectureSeule}
                actionEnCours={actionEnCours === lieu.id}
                onEdit={() => onEdit(lieu)}
                onDelete={() => onDelete(lieu)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function LieuCard({
  lieu,
  lectureSeule,
  actionEnCours,
  onEdit,
  onDelete,
}: {
  lieu: Lieu
  lectureSeule: boolean
  actionEnCours: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3 shadow-sm transition hover:border-teal-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-slate-950">{lieu.nom}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lieu.numero && <Badge>{lieu.numero}</Badge>}
            {lieu.batiment && <Badge>{lieu.batiment.nom}</Badge>}
            {lieu.categorie && <Badge tone={lieu.categorie.code}>{lieu.categorie.nom}</Badge>}
          </div>
        </div>
        {!lectureSeule && <Actions actionEnCours={actionEnCours} onEdit={onEdit} onDelete={onDelete} />}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
        <span className={lieu.est_actif ? 'inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700' : 'inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500'}>
          {lieu.est_actif ? 'Actif' : 'Inactif'}
        </span>
        {lieu.code && <span className="truncate text-xs text-slate-400">{lieu.code}</span>}
      </div>
    </div>
  )
}

function VueListe({
  lieux,
  lectureSeule,
  actionEnCours,
  onEdit,
  onDelete,
}: {
  lieux: Lieu[]
  lectureSeule: boolean
  actionEnCours: string | null
  onEdit: (lieu: Lieu) => void
  onDelete: (lieu: Lieu) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[900px] w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-slate-500">Lieu</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-500">Batiment</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-500">Categorie</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-500">Code</th>
            <th className="px-4 py-3 text-left font-semibold text-slate-500">Statut</th>
            {!lectureSeule && <th className="px-4 py-3 text-right font-semibold text-slate-500">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {lieux.map((lieu) => (
            <tr key={lieu.id}>
              <td className="px-4 py-3 font-medium text-slate-900">{afficherLieu(lieu)}</td>
              <td className="px-4 py-3 text-slate-600">{lieu.batiment?.nom || '-'}</td>
              <td className="px-4 py-3 text-slate-600">{lieu.categorie?.nom}</td>
              <td className="px-4 py-3 text-slate-500">{lieu.code || '-'}</td>
              <td className="px-4 py-3">
                <span className={lieu.est_actif ? 'rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700' : 'rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500'}>
                  {lieu.est_actif ? 'Actif' : 'Inactif'}
                </span>
              </td>
              {!lectureSeule && (
                <td className="px-4 py-3 text-right">
                  <Actions actionEnCours={actionEnCours === lieu.id} onEdit={() => onEdit(lieu)} onDelete={() => onDelete(lieu)} />
                </td>
              )}
            </tr>
          ))}
          {lieux.length === 0 && (
            <tr>
              <td colSpan={lectureSeule ? 5 : 6} className="px-4 py-8 text-center text-slate-500">
                Aucun lieu.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function PaginationListe({
  page,
  totalPages,
  totalItems,
  lignesParPage,
  onPageChange,
  onLignesParPageChange,
}: {
  page: number
  totalPages: number
  totalItems: number
  lignesParPage: number
  onPageChange: (page: number) => void
  onLignesParPageChange: (value: number) => void
}) {
  const debut = totalItems === 0 ? 0 : (page - 1) * lignesParPage + 1
  const fin = Math.min(page * lignesParPage, totalItems)

  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-sm text-slate-600">
        {debut}-{fin} sur {totalItems}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={lignesParPage}
          onChange={(event) => onLignesParPageChange(Number(event.target.value))}
          className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        >
          <option value={10}>10 / page</option>
          <option value={25}>25 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(page - 1, 1))}
            disabled={page <= 1}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Page precedente"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-20 text-center text-sm font-semibold text-slate-700">
            {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(page + 1, totalPages))}
            disabled={page >= totalPages}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function Actions({
  actionEnCours,
  onEdit,
  onDelete,
}: {
  actionEnCours: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex shrink-0 items-center justify-end gap-1">
      <button type="button" onClick={onEdit} className="rounded-md p-2 text-slate-500 hover:bg-teal-50 hover:text-teal-700" aria-label="Modifier">
        <Edit2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={actionEnCours}
        onClick={onDelete}
        className="rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
        aria-label="Supprimer"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

function TabButton({ actif, onClick, label }: { actif: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={actif ? 'rounded-md bg-white px-2 py-2 text-xs font-semibold text-teal-800 shadow-sm' : 'rounded-md px-2 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900'}
    >
      {label}
    </button>
  )
}

function VueButton({ actif, onClick, icon: Icon, label }: { actif: boolean; onClick: () => void; icon: typeof List; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={actif ? 'flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-teal-800 shadow-sm' : 'flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-500 hover:text-slate-900'}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function FiltreSelect({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <label className="block">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
      >
        {children}
      </select>
    </label>
  )
}

function StatCard({ label, value, tone = 'teal' }: { label: string; value: number; tone?: 'teal' | 'green' | 'blue' | 'slate' }) {
  const classes = {
    teal: 'bg-teal-50 text-teal-800 ring-teal-100',
    green: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
    blue: 'bg-sky-50 text-sky-800 ring-sky-100',
    slate: 'bg-slate-100 text-slate-800 ring-slate-200',
  }

  return (
    <div className={`rounded-lg px-4 py-3 ring-1 ${classes[tone]}`}>
      <p className="text-xs font-semibold uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

function Badge({ children, tone = 'default' }: { children: React.ReactNode; tone?: string }) {
  const classes =
    tone === 'chambre'
      ? 'bg-sky-50 text-sky-700 ring-sky-100'
      : tone === 'restaurant'
        ? 'bg-amber-50 text-amber-700 ring-amber-100'
        : tone === 'technique'
          ? 'bg-slate-100 text-slate-700 ring-slate-200'
          : tone === 'jardin'
            ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
            : tone === 'commun'
              ? 'bg-indigo-50 text-indigo-700 ring-indigo-100'
              : 'bg-teal-50 text-teal-700 ring-teal-100'

  return <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1 ${classes}`}>{children}</span>
}

function afficherLieu(lieu: Lieu) {
  return lieu.batiment ? `${lieu.nom} (${lieu.batiment.nom})` : lieu.nom
}

function upsertListe<T extends { id: string; nom: string }>(liste: T[], item: T) {
  const existe = liste.some((element) => element.id === item.id)
  const prochaineListe = existe ? liste.map((element) => (element.id === item.id ? item : element)) : [...liste, item]
  return prochaineListe.sort((a, b) => a.nom.localeCompare(b.nom))
}
