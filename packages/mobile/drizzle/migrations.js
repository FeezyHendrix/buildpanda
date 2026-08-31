// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_chubby_human_cannonball.sql';
import m0001 from './0001_lethal_bastion.sql';
import m0002 from './0002_lonely_cardiac.sql';
import m0003 from './0003_lonely_daredevil.sql';
import m0004 from './0004_common_thor_girl.sql';
import m0005 from './0005_clever_sumo.sql';
import m0006 from './0006_daily_report.sql';
import m0007 from './0007_recent_docs.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
m0007
    }
  }
  