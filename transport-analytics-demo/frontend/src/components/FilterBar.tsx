import { useMemo } from 'react'
import { EMPTY_FILTERS, hasActiveFilters, type Filters, type Meta } from '../api'
import { DOW, ETA, FASCE, GENERI, MOTIVO_PAIRS, NAZIONALITA, TIPOLOGIE, etaLabel, motivoPairLabel } from '../labels'
import DateRange from './DateRange'
import { IconReset } from './icons'
import MultiSelect, { type Option } from './MultiSelect'
import { getLang, t } from '../settings'

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
      ...provP.map((p) => ({ value: `p:${p.id}`, label: p.nome, hint: t('provincia', 'province'), group: t('Province del Piemonte', 'Provinces of Piedmont') })),
      ...comuni.map((z) => ({ value: `c:${z.id}`, label: z.nome, hint: z.prov_nome, group: t('Comuni del Piemonte', 'Municipalities of Piedmont') })),
      ...ace.map((a) => ({ value: `a:${a.id}`, label: a.nome, hint: a.prov_nome, group: t('Aree di censimento ISTAT (ACE)', 'ISTAT census areas (ACE)') })),
      ...provX.map((p) => ({ value: `p:${p.id}`, label: p.nome, hint: p.regione, group: t('Province fuori regione', 'Provinces outside the region') })),
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, getLang()])

  const fasciaOptions = meta.fasce.map((f) => ({ value: f.id, label: FASCE[f.id] ?? f.id, hint: `${f.da}–${f.a + 1}` }))
  const active = hasActiveFilters(filters)

  return (
    <div className="filterbar">
      <DateRange min={meta.periodo.da} max={meta.periodo.a} value={filters.periodo} onChange={set('periodo')} />
      <MultiSelect
        label={t('Giorno', 'Day')}
        options={DOW.map((d) => ({ value: String(d.id), label: d.label }))}
        value={filters.dow.map(String)}
        onChange={(v) => set('dow')(v.map(Number).sort())}
        width={200}
      />
      <MultiSelect label={t('Fascia oraria', 'Time slot')} options={fasciaOptions} value={filters.fascia} onChange={set('fascia')} width={230} />
      <MultiSelect label={t('Origine', 'Origin')} options={zoneOptions} value={filters.origine} onChange={set('origine')} searchable width={300} />
      <MultiSelect
        label={t('Destinazione', 'Destination')}
        options={zoneOptions}
        value={filters.destinazione}
        onChange={set('destinazione')}
        searchable
        width={300}
      />
      <MultiSelect
        label={t('Motivo', 'Purpose')}
        options={MOTIVO_PAIRS.map((p) => ({ value: p, label: motivoPairLabel(p) }))}
        value={filters.motivo}
        onChange={set('motivo')}
        width={260}
      />
      <MultiSelect
        label={t('Genere', 'Gender')}
        options={Object.entries(GENERI).map(([value, label]) => ({ value, label }))}
        value={filters.genere}
        onChange={set('genere')}
        width={180}
      />
      <MultiSelect
        label={t('Età', 'Age')}
        options={ETA.map((e) => ({ value: e, label: etaLabel(e) }))}
        value={filters.eta}
        onChange={set('eta')}
        width={180}
      />
      <MultiSelect
        label={t('Nazionalità', 'Nationality')}
        options={Object.entries(NAZIONALITA).map(([value, label]) => ({ value, label }))}
        value={filters.nazionalita}
        onChange={set('nazionalita')}
        width={200}
      />
      <MultiSelect
        label={t('Tipologia', 'Trip type')}
        options={Object.entries(TIPOLOGIE).map(([value, label]) => ({ value, label }))}
        value={filters.tipologia}
        onChange={set('tipologia')}
        width={250}
      />
      <button
        className="reset"
        disabled={!active}
        onClick={() => onChange(EMPTY_FILTERS)}
        title={t('Azzera filtri', 'Clear filters')}
        aria-label={t('Azzera filtri', 'Clear filters')}
      >
        <IconReset width={17} height={17} />
      </button>
    </div>
  )
}
