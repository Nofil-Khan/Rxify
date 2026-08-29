import Chapter1Hero from '../components/landing/Chapter1Hero';
import Chapter2Problem from '../components/landing/Chapter2Problem';
import Chapter3Upload from '../components/landing/Chapter3Upload';
import Chapter4AIBrain from '../components/landing/Chapter4AIBrain';
import Chapter6Timeline from '../components/landing/Chapter6Timeline';
import Chapter7Search from '../components/landing/Chapter7Search';
import Chapter8Insights from '../components/landing/Chapter8Insights';
import Chapter9Privacy from '../components/landing/Chapter9Privacy';
import Chapter10Future from '../components/landing/Chapter10Future';
import ParticlesBackground from '../components/landing/ParticlesBackground';

export default function Landing() {
  return (
    <div className="landing-wrapper">
      <ParticlesBackground />
      
      <Chapter1Hero />
      <Chapter2Problem />
      <Chapter3Upload />
      <Chapter4AIBrain />
      <Chapter6Timeline />
      <Chapter7Search />
      <Chapter8Insights />
      <Chapter9Privacy />
      <Chapter10Future />
    </div>
  );
}
