import React, { useState, useEffect } from 'react';
import { Project, Enterprise, ProcurementStepDefinition } from '../types';
import ProcurementStepConfig from './ProcurementStepConfig';
import { useProcurementRepo } from '../platform/firestore/hooks';

interface ProcurementStepConfigWrapperProps {
  project: Project;
  enterprise: Enterprise;
}

export default function ProcurementStepConfigWrapper({ project, enterprise }: ProcurementStepConfigWrapperProps) {
  const repo = useProcurementRepo();
  const [currentSteps, setCurrentSteps] = useState<ProcurementStepDefinition[]>([]);
  const [enterpriseSteps, setEnterpriseSteps] = useState<ProcurementStepDefinition[]>([]);

  useEffect(() => {
    if (!project.id) return;

    const unsubSteps = repo.subscribeProjectStepDefinitions(project.id, (steps) => {
      setCurrentSteps([...steps].sort((a, b) => (a.order || 0) - (b.order || 0)));
    });

    const unsubEntSteps = repo.subscribeEnterpriseStepDefinitions(project.enterpriseId, (steps) => {
      setEnterpriseSteps([...steps].sort((a, b) => (a.order || 0) - (b.order || 0)));
    });

    return () => {
      unsubSteps();
      unsubEntSteps();
    };
  }, [project.id, project.enterpriseId]);

  return (
    <ProcurementStepConfig
      project={project}
      enterprise={enterprise}
      currentSteps={currentSteps}
      enterpriseSteps={enterpriseSteps}
    />
  );
}
