/**
 * 蓉才通™ ATOS — Evaluation Framework
 * 
 * 统一评估系统入口。
 * 
 * 使用方式：
 * 
 * ```typescript
 * import { evalEngine, interviewEvalSuite } from '../eval';
 * 
 * // 运行评估
 * const run = await evalEngine.runSuite(interviewEvalSuite, async (input, context) => {
 *   return await myAgent.process(input, context);
 * });
 * 
 * // 检查结果
 * console.log(run.summary.overallScore); // 0-100
 * console.log(run.summary.regressions); // 回归检测
 * 
 * // 幻觉检测
 * const hallCheck = await evalEngine.detectHallucinations(output, [context]);
 * console.log(hallCheck.hallucinationScore); // 0-1
 * ```
 */

export { evalEngine, EvalEngine } from './engine';
export { 
  allEvalSuites, 
  interviewEvalSuite, 
  resumeEvalSuite, 
  peopleGPTEvalSuite, 
  memoryEvalSuite,
  getEvalSuite,
  getEvalSuiteByAgent,
} from './suites';
export * from './types';
