import {Composition} from 'remotion';
import {SmartDataPlatform} from './SmartDataPlatform';
import {FPS, TOTAL_FRAMES} from './timing';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="SmartDataPlatform"
    component={SmartDataPlatform}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={1920}
    height={1080}
  />
);
