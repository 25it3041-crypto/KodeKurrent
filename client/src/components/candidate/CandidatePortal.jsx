import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import InterviewSetup from './InterviewSetup';
import OnboardingScreen from './OnboardingScreen';
import InterviewRoom from './InterviewRoom';
import CompletionScreen from './CompletionScreen';
import useStore from '../../lib/store';

export default function CandidatePortal() {
  const { interviewPhase, setInterviewPhase, isAuthenticated, setAuthenticated } = useStore();

  const handleVerified = (email, token) => {
    setInterviewPhase('setup');
  };

  const phases = {
    setup: <InterviewSetup />,
    onboarding: <OnboardingScreen />,
    interview: <InterviewRoom />,
    completed: <CompletionScreen />,
  };

  return (
    <div className="h-full overflow-auto">
      <AnimatePresence mode="wait">
        {!isAuthenticated ? (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <EmailOTPAuth onVerified={handleVerified} />
          </motion.div>
        ) : (
          <motion.div
            key={interviewPhase}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            {phases[interviewPhase] || phases.setup}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import InterviewSetup from './InterviewSetup';
import OnboardingScreen from './OnboardingScreen';
import InterviewRoom from './InterviewRoom';
import CompletionScreen from './CompletionScreen';
import useStore from '../../lib/store';

export default function CandidatePortal() {
  const { interviewPhase } = useStore();

  const phases = {
    setup: <InterviewSetup />,
    onboarding: <OnboardingScreen />,
    interview: <InterviewRoom />,
    completed: <CompletionScreen />,
  };

  return (
    <div className="h-full overflow-auto">
      <AnimatePresence mode="wait">
        <motion.div
          key={interviewPhase}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
          className="h-full"
        >
          {phases[interviewPhase] || phases.setup}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}