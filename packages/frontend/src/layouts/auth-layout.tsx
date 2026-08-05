import { Outlet, Link } from "react-router-dom";
import whiteLogo from "@/assets/images/logo.white.svg";
import AuthIllustration from '@/assets/images/authIllustration.gif'
import { Button } from "@/components/atoms/button";


export default function AuthLayout() {
  return (
    <div className="flex h-dvh">
      <div className="relative hidden w-1/2 overflow-hidden lg:flex">
        <img
          src={AuthIllustration}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        
        <div className="relative z-10 flex h-full w-full flex-col justify-between p-12">

          <div className='flex items-center justify-between'>
            <Link to="/">
              <img src={whiteLogo} alt="BuildPanda Auth" className="h-10" />
            </Link>

            <Button size='lg' className='bg-white/11'>The Construction OS</Button>
          </div>
          {/* <video
            className="absolute inset-0 size-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster={authBgPoster}
          >
            <source src={authBg} type="video/mp4" />
          </video> */}

          {/* <img src={simulationBuilding} alt="Simulation GIF" className="w-full h-full object-contain bg-transparent" /> */}


          <div className='flex flex-col gap-4 max-w-[409px]'>
            <h3 className='text-h3 font-semibold text-white'>Build it <span className='text-secondary'>right</span>, from the ground up!</h3>
            <p className='text-body-s text-white font-[400] font-normal'>Set up your workspace in minutes then run projects, milestones, payments and inspections from one place</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col lg:px-20 lg:py-8 px-2 py-2">
        <main className="flex-1 overflow-y-auto py-8 no-scrollbar">
          <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
