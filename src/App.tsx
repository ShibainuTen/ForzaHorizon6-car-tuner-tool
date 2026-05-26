import React, { useState } from 'react';
import './style.css';

// ==================== 🛠️ データ構造定義 ====================

interface DetailedTuningProposal {
  id: number;
  notes: string;
  tirePressure: { front: number; rear: number };
  gearing: { final: number; gears: number[] };
  alignment: { 
    camber: { front: number; rear: number }; 
    toe: { front: number; rear: number }; 
    caster: number 
  }; 
  antiRollBar: { front: number; rear: number };
  springs: { 
    spring: { front: number; rear: number }; 
    rideHeight: { front: number; rear: number } 
  };
  damping: { 
    rebound: { front: number; rear: number }; 
    bump: { front: number; rear: number } 
  };
  aero: { downforce: { front: number; rear: number } };
  brake: { balance: number; pressure: number };
  differential: { accel: number; decel: number };
}

interface TestDriveFeedback {
  handling: 'Balanced' | 'EntryUnder' | 'ExitOver';
  brake: 'Good' | 'TooStrong' | 'NotWorking' | 'EasyLock';
  speed: 'Good' | 'MoreTopSpeed' | 'BadAccel';
}

interface TuningLog {
  id: number;
  runCount: number;
  carName: string;
  piClass: string;
  driveType: string;
  feedback: { handlingText: string; brakeText: string; speedText: string };
  lapTime: string;
  note: string;
  proposal: DetailedTuningProposal;
}

// ==================== 🛠️ ガチ計算式・調整ロジック ====================

// 💡 実際のフロント重量配分（%）を使って計算するように改良！
const calculateInitialSetup = (weight: number, frontWeightRatioPercent: number, driveType: string, category: string): DetailedTuningProposal => {
  const catModifier = category === 'ダート' || category === 'クロスカントリー' ? 0.15 : 0.25;
  
  // ユーザーが入力したフロント重量配分（例: 56% -> 0.56）を適用
  const frontRatio = frontWeightRatioPercent / 100;

  const baseFrontSpring = (weight * frontRatio) * catModifier;
  const baseRearSpring = (weight * (1 - frontRatio)) * catModifier;

  return {
    id: 1,
    notes: `初期提案 (実重量配分 ${frontWeightRatioPercent}% 基準)`,
    tirePressure: { front: 2.1, rear: 2.1 },
    gearing: { final: 3.55, gears: [3.01, 1.95, 1.48, 1.15, 0.94, 0.79] },
    alignment: { 
      camber: { front: -1.5, rear: -1.0 }, 
      toe: { front: 0.1, rear: 0.1 }, 
      caster: 6.0 
    },
    antiRollBar: { front: baseFrontSpring * 0.1, rear: baseRearSpring * 0.1 },
    springs: { 
      spring: { front: baseFrontSpring, rear: baseRearSpring }, 
      rideHeight: { front: 110, rear: 110 } 
    },
    damping: { 
      rebound: { front: baseFrontSpring * 0.12, rear: baseRearSpring * 0.12 }, 
      bump: { front: baseFrontSpring * 0.08, rear: baseRearSpring * 0.08 } 
    },
    aero: { downforce: { front: 100, rear: 150 } },
    brake: { balance: 50, pressure: 100 },
    differential: { accel: 50, decel: 20 },
  };
};

const updateSetupBasedOnFeedback = (current: DetailedTuningProposal, feedback: TestDriveFeedback): DetailedTuningProposal => {
  const next = JSON.parse(JSON.stringify(current)) as DetailedTuningProposal;
  next.id = current.id + 1;
  let notes: string[] = [];

  if (feedback.handling === 'EntryUnder') {
    next.antiRollBar.front *= 0.9;
    next.damping.bump.front *= 0.9;
    next.aero.downforce.front += 5;
    next.notes = `進入アンダー対策`;
  } else if (feedback.handling === 'ExitOver') {
    next.differential.accel *= 0.9;
    next.antiRollBar.rear *= 0.9;
    next.springs.spring.rear *= 0.95;
    next.aero.downforce.rear += 5;
    next.notes = `脱出オーバー対策`;
  } else {
    next.notes = `ハンドリング良好`;
  }

  if (feedback.brake === 'TooStrong' || feedback.brake === 'EasyLock') {
    next.brake.pressure *= 0.95;
    notes.push(feedback.brake === 'TooStrong' ? 'ブレーキ効きすぎ修正' : 'ロック対策');
  } else if (feedback.brake === 'NotWorking') {
    next.brake.pressure += 5;
    if (next.brake.pressure > 100) next.brake.pressure = 100;
    notes.push('効き足りない修正');
  }

  if (feedback.speed === 'MoreTopSpeed') {
    next.gearing.final *= 0.95;
    next.aero.downforce.front *= 0.95;
    next.aero.downforce.rear *= 0.95;
    notes.push('最高速重視');
  } else if (feedback.speed === 'BadAccel') {
    next.gearing.final += 0.1;
    notes.push('加速重視');
  }

  const cleanCurrentNotes = current.notes.split(' (')[0];
  next.notes = notes.length > 0 ? `${cleanCurrentNotes} -> ${next.notes} (${notes.join(', ')})` : `${cleanCurrentNotes} -> ${next.notes}`;
  return next;
};

const feedbackHandlingMap = { Balanced: '良好', EntryUnder: '進入アンダー', ExitOver: '脱出オーバー' };
const feedbackBrakeMap = { Good: '良好', TooStrong: '効きすぎる', NotWorking: '効かない', EasyLock: 'ロックしやすい' };
const feedbackSpeedMap = { Good: '良好', MoreTopSpeed: '最高速足りない', BadAccel: '加速悪い' };

export default function App() {
  // 💡 YARISのスクリーンショットに合わせた初期値に変更
  const [weight, setWeight] = useState<number | ''>(1207);
  const [frontWeight, setFrontWeight] = useState<number | ''>(56);
  const [powerKw, setPowerKw] = useState<number | ''>(290);
  
  const [carName] = useState("GR YARIS '21");
  const [piClass] = useState('A 700');
  const [driveType, setDriveType] = useState('AWD');
  const [category, setCategory] = useState('ダート');

  const [currentProposal, setCurrentProposal] = useState<DetailedTuningProposal | null>(
    calculateInitialSetup(1207, 56, 'AWD', 'ダート')
  );
  const [runCount, setRunCount] = useState(1);

  const [feedback, setFeedback] = useState<TestDriveFeedback>({ handling: 'Balanced', brake: 'Good', speed: 'Good' });
  const [lapTime, setLapTime] = useState('');
  const [note, setNote] = useState('');
  const [logs, setLogs] = useState<TuningLog[]>([]);

  const numWeight = Number(weight) || 0;
  const numFrontWeight = Number(frontWeight) || 50;

  const getInitialSetup = () => {
    if (!weight) return;
    const initial = calculateInitialSetup(numWeight, numFrontWeight, driveType, category);
    initial.notes = `初期提案 (実重量配分 ${numFrontWeight}% 基準)`;
    setCurrentProposal(initial);
    setRunCount(1);
    setLapTime('');
    setNote('');
    setFeedback({ handling: 'Balanced', brake: 'Good', speed: 'Good' });
  };

  const getNewRecommendation = () => {
    if (!currentProposal) return;
    const newProposal = updateSetupBasedOnFeedback(currentProposal, feedback);
    setCurrentProposal(newProposal);
    setLapTime('');
    setNote('');
    setFeedback({ handling: 'Balanced', brake: 'Good', speed: 'Good' });
  };

  const saveLog = () => {
    if (!currentProposal) return;
    const newLog: TuningLog = {
      id: Date.now(),
      runCount: runCount,
      carName, piClass, driveType,
      feedback: { 
        handlingText: feedbackHandlingMap[feedback.handling], 
        brakeText: feedbackBrakeMap[feedback.brake], 
        speedText: feedbackSpeedMap[feedback.speed] 
      },
      lapTime: lapTime || '--:--.--',
      note: note || '特記事項なし',
      proposal: JSON.parse(JSON.stringify(currentProposal))
    };
    setLogs([newLog, ...logs]);
    setRunCount(runCount + 1);
  };

  const ParameterField = ({ label, value }: { label: string; value: string | number }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', margin: '2px 0' }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ color: '#fff', fontWeight: 'bold' }}>{value}</span>
    </div>
  );

  return (
    <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto', fontFamily: 'sans-serif', color: '#fff' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '25px', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
        🏎️ FH6 チューニング・ループ・シミュレーター
      </h2>
      
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* 👈 左側：ゲーム画面の参照ガイド */}
        <div style={{ flex: '1 1 300px', backgroundColor: 'rgba(30, 41, 59, 0.85)', padding: '15px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '15px' }}>📸 入力値の確認場所</h3>
          <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.4' }}>
            ゲーム内の画面を参照して、右のツールにステータスを入力してください。
          </p>
          <div style={{ border: '2px solid #475569', borderRadius: '6px', overflow: 'hidden' }}>
            <img 
              src="/screenshot.png" 
              alt="ゲーム画面のステータス参照位置" 
              style={{ width: '100%', display: 'block' }} 
            />
          </div>
        </div>

        {/* 👉 右側：ツール本体 */}
        <div style={{ flex: '2 1 450px', backgroundColor: 'rgba(30, 41, 59, 0.95)', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
          
          <div style={{ backgroundColor: '#334155', padding: '12px', borderRadius: '6px', marginBottom: '15px', fontSize: '13px' }}>
            {/* 💡 入力項目をゲーム画面に合わせました */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>車重:<br/><input type="number" value={weight} onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '90%', padding: '4px', borderRadius: '3px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }} /> kg</div>
              <div style={{ flex: 1 }}>フロント配分:<br/><input type="number" value={frontWeight} onChange={(e) => setFrontWeight(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '80%', padding: '4px', borderRadius: '3px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }} /> %</div>
              <div style={{ flex: 1 }}>最高出力:<br/><input type="number" value={powerKw} onChange={(e) => setPowerKw(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '80%', padding: '4px', borderRadius: '3px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }} /> kW</div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
              <div>駆動系: {(['AWD', 'RWD', 'FWD'] as const).map(t => <button key={t} onClick={() => setDriveType(t)} style={{ padding: '4px 8px', margin: '0 3px', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: driveType === t ? '#38bdf8' : '#475569', color: '#fff', fontWeight: driveType === t ? 'bold' : 'normal' }}>{t}</button>)}</div>
              <div>用途: <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: '4px', borderRadius: '4px', backgroundColor: '#1e293b', color: '#fff', border: '1px solid #475569' }}>{['ストリート', 'ダート', 'クロスカントリー'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            
            <button onClick={getInitialSetup} style={{ width: '100%', padding: '8px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>この数値で初期提案を計算</button>
          </div>

          {currentProposal && (
            <div style={{ padding: '15px', backgroundColor: '#0f172a', border: '2px solid #38bdf8', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #38bdf8', paddingBottom: '5px', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '15px' }}>🔧 提案セッティング (仕様 #{runCount})</h3>
                <span style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 'bold' }}>{currentProposal.notes}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
                <div style={{ border: '1px solid #475569', padding: '8px', borderRadius: '6px', backgroundColor: '#1e293b' }}>
                  <strong style={{ fontSize: '12px', color: '#cbd5e1' }}>タイヤ (bar)</strong>
                    <ParameterField label="F" value={currentProposal.tirePressure.front.toFixed(1)} />
                    <ParameterField label="R" value={currentProposal.tirePressure.rear.toFixed(1)} />
                  <strong style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '6px', display: 'block' }}>スタビライザー</strong>
                    <ParameterField label="F" value={currentProposal.antiRollBar.front.toFixed(1)} />
                    <ParameterField label="R" value={currentProposal.antiRollBar.rear.toFixed(1)} />
                  <strong style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '6px', display: 'block' }}>エアロ kg</strong>
                    <ParameterField label="F" value={currentProposal.aero.downforce.front} />
                    <ParameterField label="R" value={currentProposal.aero.downforce.rear} />
                </div>
                <div style={{ border: '1px solid #475569', padding: '8px', borderRadius: '6px', backgroundColor: '#1e293b' }}>
                  <strong style={{ fontSize: '12px', color: '#cbd5e1' }}>アライメント</strong>
                    <ParameterField label="キャンバー F" value={currentProposal.alignment.camber.front.toFixed(1)} />
                    <ParameterField label="キャンバー R" value={currentProposal.alignment.camber.rear.toFixed(1)} />
                    <ParameterField label="トー F" value={currentProposal.alignment.toe.front.toFixed(1)} />
                    <ParameterField label="トー R" value={currentProposal.alignment.toe.rear.toFixed(1)} />
                    <ParameterField label="キャスター F" value={currentProposal.alignment.caster.toFixed(1)} />
                  <strong style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '6px', display: 'block' }}>スプリング/車高</strong>
                    <ParameterField label="バネ F kg/mm" value={currentProposal.springs.spring.front.toFixed(1)} />
                    <ParameterField label="バネ R kg/mm" value={currentProposal.springs.spring.rear.toFixed(1)} />
                    <ParameterField label="車高 F mm" value={currentProposal.springs.rideHeight.front} />
                    <ParameterField label="車高 R mm" value={currentProposal.springs.rideHeight.rear} />
                </div>
                <div style={{ border: '1px solid #475569', padding: '8px', borderRadius: '6px', backgroundColor: '#1e293b' }}>
                  <strong style={{ fontSize: '12px', color: '#cbd5e1' }}>ダンピング</strong>
                    <ParameterField label="リバウンド F" value={currentProposal.damping.rebound.front.toFixed(1)} />
                    <ParameterField label="リバウンド R" value={currentProposal.damping.rebound.rear.toFixed(1)} />
                    <ParameterField label="バンプ F" value={currentProposal.damping.bump.front.toFixed(1)} />
                    <ParameterField label="バンプ R" value={currentProposal.damping.bump.rear.toFixed(1)} />
                  <strong style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '6px', display: 'block' }}>ブレーキ</strong>
                    <ParameterField label="バランス %" value={currentProposal.brake.balance} />
                    <ParameterField label="圧力 %" value={currentProposal.brake.pressure.toFixed(0)} />
                  <strong style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '6px', display: 'block' }}>デフ %</strong>
                    <ParameterField label="加速" value={currentProposal.differential.accel.toFixed(0)} />
                    <ParameterField label="減速" value={currentProposal.differential.decel.toFixed(0)} />
                </div>
              </div>
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '15px' }}>🏁 テスト走行のフィーリングを教えて！</h4>
            
            <div style={{ fontSize: '13px', marginBottom: '15px' }}>
              <div style={{ marginBottom: '8px' }}>ハンドリング: {(['Balanced', 'EntryUnder', 'ExitOver'] as const).map(f => <button key={f} onClick={() => setFeedback({ ...feedback, handling: f })} style={{ padding: '4px 8px', margin: '0 3px', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: feedback.handling === f ? '#f87171' : '#475569', color: '#fff' }}>{feedbackHandlingMap[f]}</button>)}</div>
              <div style={{ marginBottom: '8px' }}>ブレーキ: {(['Good', 'TooStrong', 'NotWorking', 'EasyLock'] as const).map(f => <button key={f} onClick={() => setFeedback({ ...feedback, brake: f })} style={{ padding: '4px 8px', margin: '0 3px', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: feedback.brake === f ? '#f87171' : '#475569', color: '#fff' }}>{feedbackBrakeMap[f]}</button>)}</div>
              <div style={{ marginBottom: '8px' }}>速度関連: {(['Good', 'MoreTopSpeed', 'BadAccel'] as const).map(f => <button key={f} onClick={() => setFeedback({ ...feedback, speed: f })} style={{ padding: '4px 8px', margin: '0 3px', borderRadius: '4px', border: 'none', cursor: 'pointer', backgroundColor: feedback.speed === f ? '#f87171' : '#475569', color: '#fff' }}>{feedbackSpeedMap[f]}</button>)}</div>
            </div>

            <div style={{ backgroundColor: '#334155', padding: '12px', borderRadius: '6px' }}>
              <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#38bdf8', fontSize: '13px' }}>📝 テスト走行の記録</p>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <input type="text" placeholder="タイム (例 1:12.345)" value={lapTime} onChange={(e) => setLapTime(e.target.value)} style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #475569', backgroundColor: '#1e293b', color: '#fff', fontSize: '13px' }} />
                <input type="text" placeholder="メモ（例：跳ねる）" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 2, padding: '6px', borderRadius: '4px', border: '1px solid #475569', backgroundColor: '#1e293b', color: '#fff', fontSize: '13px' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={saveLog} style={{ flex: 1, padding: '8px', backgroundColor: '#22c55e', color: '#0f172a', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>履歴に保存</button>
                <button onClick={getNewRecommendation} style={{ flex: 1, padding: '8px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>フィードバックから再提案</button>
              </div>
            </div>
          </div>

          {logs.length > 0 && (
            <div style={{ marginTop: '20px', borderTop: '2px solid #475569', paddingTop: '15px' }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#a78bfa', fontSize: '15px' }}>📊 チューニング履歴</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {logs.map((log) => (
                  <div key={log.id} style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '6px', fontSize: '12px', borderLeft: '4px solid #a78bfa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #475569', paddingBottom: '5px', marginBottom: '5px' }}>
                      <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>仕様 #{log.runCount} ({log.driveType}) - {log.proposal.notes}</span>
                      <span style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '13px' }}>⏱️ {log.lapTime}</span>
                    </div>
                    <p style={{ margin: '4px 0' }}>🧠 ハンドリング: {log.feedback.handlingText} | ブレーキ: {log.feedback.brakeText} | 速度: {log.feedback.speedText}</p>
                    <details>
                      <summary style={{ cursor: 'pointer', color: '#94a3b8', margin: '4px 0' }}>詳細セッティングを表示</summary>
                      <div style={{ fontSize: '11px', color: '#cbd5e1', padding: '8px', backgroundColor: '#0f172a', borderRadius: '4px', marginTop: '5px', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                        {`タイヤ: F ${log.proposal.tirePressure.front.toFixed(1)}, R ${log.proposal.tirePressure.rear.toFixed(1)} bar\n`}
                        {`スタビ: F ${log.proposal.antiRollBar.front.toFixed(1)}, R ${log.proposal.antiRollBar.rear.toFixed(1)}\n`}
                        {`スプリング: F ${log.proposal.springs.spring.front.toFixed(1)}, R ${log.proposal.springs.spring.rear.toFixed(1)} kg/mm\n`}
                        {`車高: F ${log.proposal.springs.rideHeight.front}, R ${log.proposal.springs.rideHeight.rear} mm\n`}
                        {`ブレーキ pressure: ${log.proposal.brake.pressure.toFixed(0)}%\n`}
                        {`デフ accel: ${log.proposal.differential.accel.toFixed(0)}%, decel: ${log.proposal.differential.decel.toFixed(0)}%`}
                      </div>
                    </details>
                    <p style={{ margin: '4px 0 0 0', color: '#cbd5e1' }}>💬 メモ: {log.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}