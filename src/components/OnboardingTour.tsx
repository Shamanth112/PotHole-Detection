import React, { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { motion, AnimatePresence } from 'motion/react';

interface OnboardingTourProps {
  userName: string;
}

export default function OnboardingTour({ userName }: OnboardingTourProps) {
  const [run, setRun] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('hasSeenTour');
    if (!hasSeenTour) {
      setShowWelcome(true);
    }
  }, []);

  const handleStartTour = () => {
    setShowWelcome(false);
    setRun(true);
  };

  const handleSkipTour = () => {
    setShowWelcome(false);
    localStorage.setItem('hasSeenTour', 'true');
  };

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem('hasSeenTour', 'true');
    }
  };

  const steps: Step[] = [
    {
      target: 'body',
      placement: 'center',
      content: (
        <div className="text-left font-sans">
          <h2 className="text-lg font-bold mb-2 text-[#1a365d]">Welcome to RoadGuard!</h2>
          <p className="text-sm text-gray-600">Let's take a quick tour to help you get started with the essential features.</p>
        </div>
      ),
      disableBeacon: true,
    },
    {
      target: '[data-tour="dashboard"]',
      content: (
        <div className="text-left font-sans">
          <h2 className="text-lg font-bold mb-2 text-[#1a365d]">Dashboard</h2>
          <p className="text-sm text-gray-600">Overview of your contributions and recent activity.</p>
        </div>
      ),
    },
    {
      target: '[data-tour="map"]',
      content: (
        <div className="text-left font-sans">
          <h2 className="text-lg font-bold mb-2 text-[#1a365d]">Live Map</h2>
          <p className="text-sm text-gray-600">View potholes reported by you and others around you.</p>
        </div>
      ),
    },
    {
      target: '[data-tour="scan"]',
      content: (
        <div className="text-left font-sans">
          <h2 className="text-lg font-bold mb-2 text-[#1a365d]">AI Scanner</h2>
          <p className="text-sm text-gray-600">Use your camera to automatically detect and report potholes.</p>
        </div>
      ),
    },
    {
      target: '[data-tour="profile"]',
      content: (
        <div className="text-left font-sans">
          <h2 className="text-lg font-bold mb-2 text-[#1a365d]">Your Profile</h2>
          <p className="text-sm text-gray-600">Manage your settings and view your total points.</p>
        </div>
      ),
    }
  ];

  return (
    <>
      <AnimatePresence>
        {showWelcome && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border border-white/20"
            >
              <div className="w-16 h-16 bg-[#1a365d] rounded-2xl mx-auto flex items-center justify-center mb-6 shadow-xl">
                <span className="text-3xl">👋</span>
              </div>
              <h2 className="text-2xl font-black text-[#1a365d] mb-2 tracking-tight">
                Welcome, {userName}!
              </h2>
              <p className="text-[#718096] text-sm font-medium mb-8">
                Thank you for joining RoadGuard. Ready to see how you can make a difference?
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleStartTour}
                  className="w-full bg-[#1a365d] text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all text-sm uppercase tracking-wider"
                >
                  Start Quick Tour
                </button>
                <button
                  onClick={handleSkipTour}
                  className="w-full text-[#a0aec0] py-3.5 rounded-xl font-bold hover:bg-[#f7fafc] active:scale-95 transition-all text-sm"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Joyride
        steps={steps}
        run={run}
        continuous
        showProgress
        showSkipButton
        hideCloseButton
        disableOverlayClose
        callback={handleJoyrideCallback}
        styles={{
          options: {
            primaryColor: '#1a365d',
            textColor: '#1a365d',
            backgroundColor: '#ffffff',
            arrowColor: '#ffffff',
          },
          tooltipContainer: {
            textAlign: 'left',
          },
          buttonNext: {
            backgroundColor: '#1a365d',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            padding: '8px 16px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          },
          buttonBack: {
            marginRight: 10,
            color: '#718096',
            fontSize: '14px',
            fontWeight: 'bold',
          },
          buttonSkip: {
            color: '#a0aec0',
            fontSize: '14px',
            fontWeight: '600',
          }
        }}
      />
    </>
  );
}
