import openings from './openings.js';
import respMajor from './resp-major.js';
import respMinor from './resp-minor.js';
import rebids from './rebids.js';
import respRebids from './resp-rebids.js';
import notrump from './notrump.js';
import twos from './twos.js';
import slam from './slam.js';

const ALL = [...openings, ...respMajor, ...respMinor, ...rebids, ...respRebids, ...notrump, ...twos, ...slam];
export default ALL;
