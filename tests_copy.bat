@echo off
robocopy tests "Mediplanner produccion\Tests_Produccion" /E /XD "stress tests" /XF "Consultation.stress.test.spec.ts"
