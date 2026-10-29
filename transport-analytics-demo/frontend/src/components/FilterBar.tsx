import { useMemo } from 'react'
import type { Filters, Meta } from '../api'
import { DOW, ETA, FASCE, GENERI, MOTIVO_PAIRS, NAZIONALITA, TIPOLOGIE, etaLabel, motivoPairLabel } from '../labels'
import MultiSelect, { type Option } from './MultiSelect'

interface Props {
  meta: Meta
  filters: Filters
  onChange: (f: Filters) => void
}

export default function FilterBar({ meta, filters, onChange }: Props) {
  const set = <K extends keyof Filters>(k: K) => (v: Filters[K]) => onChange({ ...filters, [k]: v })

  const zoneOptions = useMemo<Option[]>(() => {
    const provP = meta.province.filter((p) => p.piemonte)
    const provX = meta.province.filter((p) => !p.piemonte)
    const comuni = meta.zone.filter((z) => z.piemonte)
    // ACE elencate solo per i comuni suddivisi in più aree: per gli altri coincidono con il comune
    const multi = new Set<number>()
    const seen = new Set<number>()
    for (const a of meta.ace) if (a.piemonte) (seen.has(a.comune_id) ? multi : seen).add(a.comune_id)
    const ace = meta.ace
      .filter((a) => a.piemonte && multi.has(a.comune_id))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'it', { numeric: true }))
    return [
      ...provP.map((p) => ({ value: `p:${p.id}`, label: p.nome, hint: 'provincia', group: 'Province del Piemonte' })),
      ...comuni.map((z) => ({ value: `c:${z.id}`, label: z.nome, hint: z.prov_nome, group: 'Comuni del Piemonte' })),
      ...ace.map((a) => ({ value: `a:${a.id}`, label: a.nome, hint: a.prov_nome, group: 'Aree di censimento ISTAT (ACE)' })),
      ...provX.map((p) => ({ value: `p:${p.id}`, label: p.nome, hint: p.regione, group: 'Province fuori regione' })),
    ]
  }, [meta])

  const fasciaOptions = meta.fasce.map((f) => ({ value: f.id, label: FASCE[f.id] ?? f.id, hint: `${f.da}–${f.a + 1}` }))
  const active = Object.values(filters).some((v) => v.length)

  return (
    <div className="filterbar">
      <MultiSelect
        label="Giorno"
        options={DOW.map((d) => ({ value: String(d.id), label: d.label }))}
        value={filters.dow.map(String)}
        onChange={(v) => set('dow')(v.map(Number).sort())}
        width={200}
      />
      <MultiSelect label="Fascia oraria" options={fasciaOptions} value={filters.fascia} onChange={set('fascia')} width={230} />
      <MultiSelect label="Origine" options={zoneOptions} value={filters.origine} onChange={set('origine')} searchable width={300} />
      <MultiSelect
        label="Destinazione"
        options={zoneOptions}
        value={filters.destinazione}
        onChange={set('destinazione')}
        searchable
        width={300}
      />
      <MultiSelect
        label="Motivo"
        options={MOTIVO_PAIRS.map((p) => ({ value: p, label: motivoPairLabel(p) }))}
        value={filters.motivo}
        onChange={set('motivo')}
        width={260}
      />
      <MultiSelect
        label="Genere"
        options={Object.entries(GENERI).map(([value, label]) => ({ value, label }))}
        value={filters.genere}
        onChange={set('genere')}
        width={180}
      />
      <MultiSelect
        label="Età"
        options={ETA.map((e) => ({ value: e, label: etaLabel(e) }))}
        value={filters.eta}
        onChange={set('eta')}
        width={180}
      />
      <MultiSelect
        label="Nazionalità"
        options={Object.entries(NAZIONALITA).map(([value, label]) => ({ value, label }))}
        value={filters.nazionalita}
        onChange={set('nazionalita')}
        width={200}
      />
      <MultiSelect
        label="Tipologia"
        options={Object.entries(TIPOLOGIE).map(([value, label]) => ({ value, label }))}
        value={filters.tipologia}
        onChange={set('tipologia')}
        width={250}
      />
      <button
        className="reset"
        disabled={!active}
        onClick={() => onChange(Object.fromEntries(Object.keys(filters).map((k) => [k, []])) as unknown as Filters)}
      >
        Azzera filtri
      </button>
    </div>
  )
}
