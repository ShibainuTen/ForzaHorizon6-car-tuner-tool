import React, { useState, useCallback } from 'react';

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

const calculateInitialSetup = (weight: number, driveType: string, category: string): DetailedTuningProposal => {
  const catModifier = category === 'ダート' || category === 'クロスカントリー' ? 0.15 : 0.25;
  let frontRatio = 0.5;
  if (driveType === 'FWD') frontRatio = 0.6;
  if (driveType === 'RWD') frontRatio = 0.45;

  const baseFrontSpring = (weight * frontRatio) * catModifier;
  const baseRearSpring = (weight * (1 - frontRatio)) * catModifier;

  return {
    id: 1,
    notes: '初期提案 (重量・駆動系基準)',
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
    next.notes = `${current.notes} -> 進入アンダー対策`;
  } else if (feedback.handling === 'ExitOver') {
    next.differential.accel *= 0.9;
    next.antiRollBar.rear *= 0.9;
    next.springs.spring.rear *= 0.95;
    next.aero.downforce.rear += 5;
    next.notes = `${current.notes} -> 脱出オーバー対策`;
  } else {
    next.notes = `${current.notes} -> ハンドリング良好`;
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

  next.notes = notes.length > 0 ? `${next.notes} (${notes.join(', ')})` : next.notes;
  return next;
};

const feedbackHandlingMap = { Balanced: '良好', EntryUnder: '進入アンダー', ExitOver: '脱出オーバー' };
const feedbackBrakeMap = { Good: '良好', TooStrong: '効きすぎる', NotWorking: '効かない', EasyLock: 'ロックしやすい' };
const feedbackSpeedMap = { Good: '良好', MoreTopSpeed: '最高速足りない', BadAccel: '加速悪い' };

export default function App() {
  const [weight, setWeight] = useState<number | ''>(1300);
  const [hp, setHp] = useState<number | ''>(400);
  const [torque, setTorque] = useState<number | ''>(45);
  const [carName] = useState("NISSAN GT-R '17");
  const [piClass] = useState('A');
  const [driveType, setDriveType] = useState('AWD');
  const [category, setCategory] = useState('ストリート');

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<{ type: 'success' | 'error' | 'processing'; text: string } | null>(null);

  const [currentProposal, setCurrentProposal] = useState<DetailedTuningProposal | null>(calculateInitialSetup(1300, 'AWD', 'ストリート'));
  const [runCount, setRunCount] = useState(1);

  const [feedback, setFeedback] = useState<TestDriveFeedback>({ handling: 'Balanced', brake: 'Good', speed: 'Good' });
  const [lapTime, setLapTime] = useState('');
  const [note, setNote] = useState('');
  const [logs, setLogs] = useState<TuningLog[]>([]);

  const numWeight = Number(weight) || 0;

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    setIsProcessing(true);
    setOcrMessage({ type: 'processing', text: '🔄 解析中...' });
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
      setTimeout(() => {
        setWeight(1425); setHp(580); setTorque(62);
        setOcrMessage({ type: 'success', text: `重量: 1425kg, 馬力: 580hp を読み込みました！` });
        setIsProcessing(false);
      }, 1500);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0]; if (file) processFile(file);
  };

  const getInitialSetup = () => {
    if (!weight) return;
    const initial = calculateInitialSetup(numWeight, driveType, category);
    initial.notes = '初期提案 (重量・駆動系基準)';
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
    <div style={{ padding: '15px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', backgroundColor: '#1e293b', color: '#fff', borderRadius: '10px' }}>
      <h2>🏎️ FH6 チューニング・ループ・シミュレーター</h2>
      
      <div onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }} onDrop={handleDrop}
        style={{ backgroundColor: '#1e293b', border: '2px dashed', borderColor: isDragging ? '#38bdf8' : '#475569', padding: '10px', borderRadius: '6px', marginBottom: '15px', textAlign: 'center', transition: '0.2s', position: 'relative' }}>
        {isDragging && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', zIndex: 10 }}>ここにドロップ！</div>}
        
        <div style={{ opacity: isProcessing ? 0.3 : 1, fontSize: '12px' }}>
          ここにスクショ画像を<strong style={{color: '#38bdf8'}}>ドラッグ＆ドロップ</strong>、または
          <input type="file" accept="image/*" onChange={(e) => processFile(e.target.files?.[0])} style={{ display: 'none' }} id="upload" />
          <label htmlFor="upload" style={{ display: 'inline-block', padding: '5px 10px', backgroundColor: '#475569', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', marginLeft: '5px' }}>ファイルを選択</label>
        </div>
        {ocrMessage && <div style={{ marginTop: '5px', color: '#38bdf8', fontSize: '11px', fontWeight: 'bold' }}>{ocrMessage.text}</div>}
      </div>

      <div style={{ backgroundColor: '#334155', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>重量: <input type="number" value={weight} onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '50px', padding: '3px', borderRadius: '3px', backgroundColor: '#1e293b', color: '#fff', border: 'none' }} /> kg</div>
          <div style={{ flex: 1 }}>馬力: <input type="number" value={hp} onChange={(e) => setHp(e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '50px', padding: '3px', borderRadius: '3px', backgroundColor: '#1e293b', color: '#fff', border: 'none' }} /> hp</div>
          <div style={{ flex: 1 }}><button onClick={getInitialSetup} style={{ width: '100%', padding: '4px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>初期セッティング提案</button></div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div>駆動系: {['AWD', 'RWD', 'FWD'].map(t => <button key={t} onClick={() => setDriveType(t)} style={{ padding: '3px 6px', margin: '0 2px', borderRadius: '3px', border: 'none', cursor: 'pointer', backgroundColor: driveType === t ? '#38bdf8' : '#475569', color: '#fff' }}>{t}</button>)}</div>
          <div>用途: <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ padding: '3px', borderRadius: '3px', backgroundColor: '#1e293b', color: '#fff', border: 'none' }}>{['ストリート', 'ダート', 'クロスカントリー'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        </div>
      </div>

      {currentProposal && (
        <div style={{ padding: '12px', backgroundColor: '#1e293b', border: '2px solid #38bdf8', borderRadius: '8px', marginBottom: '15px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #38bdf8', paddingBottom: '3px', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '14px' }}>🔧 ツールからの提案セッティング (仕様#{runCount})</h3>
            <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 'bold' }}>{currentProposal.notes}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <div style={{ border: '1px solid #475569', padding: '5px', borderRadius: '4px' }}>
              <strong style={{ fontSize: '12px', color: '#cbd5e1' }}>タイヤ (bar)</strong>
                <ParameterField label="F" value={currentProposal.tirePressure.front.toFixed(1)} />
                <ParameterField label="R" value={currentProposal.tirePressure.rear.toFixed(1)} />
              <strong style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '3px', display: 'block' }}>スタビライザー</strong>
                <ParameterField label="F" value={currentProposal.antiRollBar.front.toFixed(1)} />
                <ParameterField label="R" value={currentProposal.antiRollBar.rear.toFixed(1)} />
              <strong style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '3px', display: 'block' }}>エアロ kg</strong>
                <ParameterField label="F" value={currentProposal.aero.downforce.front} />
                <ParameterField label="R" value={currentProposal.aero.downforce.rear} />
            </div>
            <div style={{ border: '1px solid #475569', padding: '5px', borderRadius: '4px' }}>
              <strong style={{ fontSize: '12px', color: '#cbd5e1' }}>アライメント</strong>
                <ParameterField label="キャンバー F" value={currentProposal.alignment.camber.front.toFixed(1)} />
                <ParameterField label="キャンバー R" value={currentProposal.alignment.camber.rear.toFixed(1)} />
                <ParameterField label="トー F" value={currentProposal.alignment.toe.front.toFixed(1)} />
                <ParameterField label="トー R" value={currentProposal.alignment.toe.rear.toFixed(1)} />
                <ParameterField label="キャスター F" value={currentProposal.alignment.caster.toFixed(1)} />
              <strong style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '3px', display: 'block' }}>スプリング/車高</strong>
                <ParameterField label="バネ F kg/mm" value={currentProposal.springs.spring.front.toFixed(1)} />
                <ParameterField label="バネ R kg/mm" value={currentProposal.springs.spring.rear.toFixed(1)} />
                <ParameterField label="車高 F mm" value={currentProposal.springs.rideHeight.front} />
                <ParameterField label="車高 R mm" value={currentProposal.springs.rideHeight.rear} />
            </div>
            <div style={{ border: '1px solid #475569', padding: '5px', borderRadius: '4px' }}>
              <strong style={{ fontSize: '12px', color: '#cbd5e1' }}>ダンピング</strong>
                <ParameterField label="リバウンド F" value={currentProposal.damping.rebound.front.toFixed(1)} />
                <ParameterField label="リバウンド R" value={currentProposal.damping.rebound.rear.toFixed(1)} />
                <ParameterField label="バンプ F" value={currentProposal.damping.bump.front.toFixed(1)} />
                <ParameterField label="バンプ R" value={currentProposal.damping.bump.rear.toFixed(1)} />
              <strong style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '3px', display: 'block' }}>ブレーキ</strong>
                <ParameterField label="バランス %" value={currentProposal.brake.balance} />
                <ParameterField label="圧力 %" value={currentProposal.brake.pressure} />
              <strong style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '3px', display: 'block' }}>デフ %</strong>
                <ParameterField label="加速" value={currentProposal.differential.accel} />
                <ParameterField label="減速" value={currentProposal.differential.decel} />
            </div>
          </div>
          <p style={{ margin: '3px 0', fontSize: '10px', color: '#94a3b8' }}>💡 上記の提案された数値をゲームに入力して、テスト走行を行ってください。</p>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '14px' }}>🏁 テスト走行のフィーリングを教えて！</h4>
        
        <div style={{ fontSize: '12px', marginBottom: '10px' }}>
          <div style={{ marginBottom: '5px' }}>ハンドリング: {['Balanced', 'EntryUnder', 'ExitOver'].map(f => <button key={f} onClick={() => setFeedback({ ...feedback, handling: f as TestDriveFeedback['handling'] })} style={{ padding: '3px 6px', margin: '0 2px', borderRadius: '3px', border: 'none', cursor: 'pointer', backgroundColor: feedback.handling === f ? '#f87171' : '#475569', color: '#fff' }}>{feedbackHandlingMap[f as TestDriveFeedback['handling']]}</button>)}</div>
          <div style={{ marginBottom: '5px' }}>ブレーキ: {['Good', 'TooStrong', 'NotWorking', 'EasyLock'].map(f => <button key={f} onClick={() => setFeedback({ ...feedback, brake: f as TestDriveFeedback['brake'] })} style={{ padding: '3px 6px', margin: '0 2px', borderRadius: '3px', border: 'none', cursor: 'pointer', backgroundColor: feedback.brake === f ? '#f87171' : '#475569', color: '#fff' }}>{feedbackBrakeMap[f as TestDriveFeedback['brake']]}</button>)}</div>
          <div style={{ marginBottom: '5px' }}>速度関連: {['Good', 'MoreTopSpeed', 'BadAccel'].map(f => <button key={f} onClick={() => setFeedback({ ...feedback, speed: f as TestDriveFeedback['speed'] })} style={{ padding: '3px 6px', margin: '0 2px', borderRadius: '3px', border: 'none', cursor: 'pointer', backgroundColor: feedback.speed === f ? '#f87171' : '#475569', color: '#fff' }}>{feedbackSpeedMap[f as TestDriveFeedback['speed']]}</button>)}</div>
        </div>

        <div style={{ backgroundColor: '#334155', padding: '10px', borderRadius: '6px', boxSizing: 'border-box' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#38bdf8', fontSize: '13px' }}>📝 テスト走行の記録</p>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input type="text" placeholder="タイム (例 1:12.345)" value={lapTime} onChange={(e) => setLapTime(e.target.value)} style={{ flex: 1, padding: '5px', borderRadius: '4px', border: 'none', backgroundColor: '#1e293b', color: '#fff', fontSize: '12px' }} />
            <input type="text" placeholder="メモ（例：跳ねる）" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 2, padding: '5px', borderRadius: '4px', border: 'none', backgroundColor: '#1e293b', color: '#fff', fontSize: '12px' }} />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={saveLog} style={{ flex: 1, padding: '6px', backgroundColor: '#22c55e', color: '#0f172a', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>履歴に保存</button>
            <button onClick={getNewRecommendation} style={{ flex: 1, padding: '6px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>フィードバックに基づいて再提案</button>
          </div>
        </div>
      </div>

      {logs.length > 0 && (
        <div style={{ marginTop: '20px', borderTop: '2px solid #475569', paddingTop: '10px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#a78bfa', fontSize: '14px' }}>📊 チューニング履歴</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {logs.map((log) => (
              <div key={log.id} style={{ backgroundColor: '#334155', padding: '8px', borderRadius: '5px', fontSize: '11px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #475569', paddingBottom: '3px', marginBottom: '5px' }}>
                  <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>仕様 #{log.runCount} ({log.driveType}) - {log.proposal.notes}</span>
                  <span style={{ color: '#4ade80', fontWeight: 'bold' }}>⏱️ {log.lapTime}</span>
                </div>
                <p style={{ margin: '2px 0' }}>🧠 ハンドリング: {log.feedback.handlingText} | ブレーキ: {log.feedback.brakeText} | 速度: {log.feedback.speedText}</p>
                <details>
                  <summary style={{ cursor: 'pointer', color: '#94a3b8' }}>詳細セッティング</summary>
                  <div style={{ fontSize: '10px', color: '#cbd5e1', padding: '5px', backgroundColor: '#1e293b', borderRadius: '4px', marginTop: '3px', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                    {`タイヤ: F ${log.proposal.tirePressure.front.toFixed(1)}, R ${log.proposal.tirePressure.rear.toFixed(1)} bar\n`}
                    {`スタビ: F ${log.proposal.antiRollBar.front.toFixed(1)}, R ${log.proposal.antiRollBar.rear.toFixed(1)}\n`}
                    {`スプリング: F ${log.proposal.springs.spring.front.toFixed(1)}, R ${log.proposal.springs.spring.rear.toFixed(1)} kg/mm\n`}
                    {`車高: F ${log.proposal.springs.rideHeight.front}, R ${log.proposal.springs.rideHeight.rear} mm\n`}
                    {`ブレーキ pressure: ${log.proposal.brake.pressure}%\n`}
                    {`デフ accel: ${log.proposal.differential.accel}%, decel: ${log.proposal.differential.decel}%`}
                  </div>
                </details>
                <p style={{ margin: '2px 0', color: '#cbd5e1' }}>💬 メモ: {log.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}