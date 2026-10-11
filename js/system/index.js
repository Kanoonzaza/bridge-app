import openings from './openings.js';
import respMajor from './resp-major.js';
import respMinor from './resp-minor.js';
import rebids from './rebids.js';
import respRebids from './resp-rebids.js';
import notrump from './notrump.js';
import twos from './twos.js';
import slam from './slam.js';
import round3 from './round3.js';
import competitive from './competitive.js';
import './compete-advice.js'; // attaches Advisor decisions to the competitive meanings

const ALL = [...openings, ...respMajor, ...respMinor, ...rebids, ...respRebids, ...notrump, ...twos, ...slam, ...round3, ...competitive];
export default ALL;
