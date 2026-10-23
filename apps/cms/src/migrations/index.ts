import * as migration_20261010_174918_core_baseline from './20261010_174918_core_baseline';
import * as migration_20261011_154509_search_text from './20261011_154509_search_text';
import * as migration_20261017_224251_petition_dedupe from './20261017_224251_petition_dedupe';
import * as migration_20261018_063258_translated_addresses from './20261018_063258_translated_addresses';
import * as migration_20261023_052347_payload_3_91 from './20261023_052347_payload_3_91';

export const migrations = [
  {
    up: migration_20261010_174918_core_baseline.up,
    down: migration_20261010_174918_core_baseline.down,
    name: '20261010_174918_core_baseline'
  },
  {
    up: migration_20261011_154509_search_text.up,
    down: migration_20261011_154509_search_text.down,
    name: '20261011_154509_search_text'
  },
  {
    up: migration_20261017_224251_petition_dedupe.up,
    down: migration_20261017_224251_petition_dedupe.down,
    name: '20261017_224251_petition_dedupe'
  },
  {
    up: migration_20261018_063258_translated_addresses.up,
    down: migration_20261018_063258_translated_addresses.down,
    name: '20261018_063258_translated_addresses'
  },
  {
    up: migration_20261023_052347_payload_3_91.up,
    down: migration_20261023_052347_payload_3_91.down,
    name: '20261023_052347_payload_3_91'
  },
];
