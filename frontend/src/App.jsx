import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Upload, Download, Truck, Calculator, History as HistoryIcon, Save, Settings, Search, Trash2, CheckCircle, ChevronLeft, ChevronRight, Eye, EyeOff, X, TrendingUp, BarChart2, PieChart as PieChartIcon, Activity, Target
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line, AreaChart, Area
} from 'recharts';

// 실행 환경에 따라 백엔드 주소를 자동으로 설정합니다.
const isProduction = window.location.hostname.includes('onrender.com');
const API_BASE = isProduction 
  ? '/api' 
  : `http://${window.location.hostname}:3001/api`;

function App() {
  const [history, setHistory] = useState([]);
  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('calculate'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectedPartIds, setSelectedPartIds] = useState([]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 30;

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authPw, setAuthPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [uploadMode, setUploadMode] = useState('append'); 
  const fileInputRef = useRef(null);

  const [newPart, setNewPart] = useState({ 차종: '', 품명: '', 용기_장: '', 용기_폭: '', 용기_고: '', 적입수량: '' });
  const [calcForm, setCalcForm] = useState({ 차종: '', 품명: '', 납품차량: '9.5TON', 출발지: '', 목적지: '', 거리: '', isManualCost: false, manualCost: '' });

  useEffect(() => {
    fetchData();
    document.title = "표준운송비 관리 대시보드";
  }, []);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, activeTab]);

  const fetchData = async () => {
    try {
      const [historyRes, partsRes] = await Promise.all([
        axios.get(`${API_BASE}/history`),
        axios.get(`${API_BASE}/parts`)
      ]);
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
      setParts(Array.isArray(partsRes.data) ? partsRes.data : []);
    } catch (error) { console.error('Data fetching error:', error); }
  };

  const formatNumber = (num) => {
    const n = String(unformatNumber(num));
    if (n === "" || isNaN(n)) return "";
    return n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  const formatWon = (num) => {
    const n = Number(num);
    if (isNaN(n)) return "0 원";
    return n.toLocaleString() + " 원";
  };

  const formatWonK = (num) => {
    const n = Number(num);
    if (isNaN(n)) return "0 천 원";
    return Math.floor(n / 1000).toLocaleString() + " 천 원";
  };

  const formatDateTime = (val) => {
    if (!val) return "-";
    const num = Number(val);
    // 숫자로 변환 가능하고, 그 값이 엑셀 날짜 범위(예: 40000 이상)인 경우
    if (!isNaN(num) && num > 40000 && num < 60000) {
      const date = new Date((num - 25569) * 86400 * 1000);
      return date.toLocaleString();
    }
    return val;
  };

  const unformatNumber = (str) => String(str || "").replace(/,/g, "");

  const handleManualCostChange = (e) => {
    const value = unformatNumber(e.target.value);
    if (!isNaN(value)) setCalcForm({ ...calcForm, manualCost: value });
  };

  const handlePartSave = async (e) => {
    e.preventDefault();
    if (!/[a-zA-Z가-힣]/.test(newPart.차종) || !/[a-zA-Z가-힣]/.test(newPart.품명)) {
      alert('차종과 품명에는 문자가 포함되어야 합니다.'); return;
    }
    try {
      await axios.post(`${API_BASE}/parts`, newPart);
      alert('부품 정보가 저장되었습니다.'); fetchData();
      setNewPart({ 차종: '', 품명: '', 용기_장: '', 용기_폭: '', 용기_고: '', 적입수량: '' });
    } catch (error) { alert('저장 오류'); }
  };

  const handleCalculate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/calculate`, calcForm);
      alert('산출 완료'); fetchData();
    } catch (error) { alert('산출 오류. 데이터를 확인하세요.'); }
  };

  const handleDelete = async (type) => {
    const ids = type === 'history' ? selectedIds : selectedPartIds;
    if (ids.length === 0) return;
    if (window.confirm(`선택한 ${ids.length}건을 삭제하시겠습니까?`)) {
      try {
        await axios.post(`${API_BASE}/${type === 'history' ? 'history' : 'parts'}/delete`, { ids });
        type === 'history' ? setSelectedIds([]) : setSelectedPartIds([]);
        fetchData();
      } catch (error) { alert('삭제 오류'); }
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', authPw);
    formData.append('mode', uploadMode);
    setLoading(true);
    setShowAuthModal(false);
    try {
      const res = await axios.post(`${API_BASE}/db/upload`, formData);
      // 서버 응답이 undefined인 경우를 방지합니다.
      const msg = res.data.message || res.data.error || '성공했으나 응답 메시지가 없습니다.';
      alert(msg);
      fetchData();
    } catch (error) { 
      console.error("Upload Error:", error);
      const errMsg = error.response?.data?.error || error.message || '알 수 없는 업로드 오류';
      alert(`업로드 실패: ${errMsg}`); 
    } 
    finally { setLoading(false); e.target.value = null; setAuthPw(''); }
  };

  const costTrendData = [
    { name: '1월', 표준총액: 12500000, 실제총액: 13800000, 표준단가: 615, 실제단가: 780 },
    { name: '2월', 표준총액: 11800000, 실제총액: 11500000, 표준단가: 615, 실제단가: 605 },
    { name: '3월', 표준총액: 14200000, 실제총액: 16500000, 표준단가: 615, 실제단가: 890 },
    { name: '4월', 표준총액: 13500000, 실제총액: 13200000, 표준단가: 615, 실제단가: 610 },
    { name: '5월', 표준총액: 15800000, 실제총액: 18200000, 표준단가: 615, 실제단가: 920 },
  ];

  const loadingRateData = [
    { route: 'A 노선', 표준적재: 252, 실제평균: 240 },
    { route: 'B 노선', 표준적재: 252, 실제평균: 168 },
    { route: 'C 노선', 표준적재: 216, 실제평균: 216 },
    { route: 'D 노선', 표준적재: 288, 실제평균: 210 },
  ];

  const vehicleComplianceData = [
    { name: '9.5TON (표준)', value: 124 },
    { name: '5TON 쪼개기 (비정상)', value: 42 },
    { name: '기타 임의변경', value: 18 },
  ];
  const VEHICLE_COLORS = ['#818cf8', '#ef4444', '#fbbf24'];

  const filteredData = activeTab === 'calculate' 
    ? history.filter(h => h.품명.toLowerCase().includes(searchTerm.toLowerCase()) || h.차종.toLowerCase().includes(searchTerm.toLowerCase()))
    : parts.filter(p => p.품명.toLowerCase().includes(searchTerm.toLowerCase()) || p.차종.toLowerCase().includes(searchTerm.toLowerCase()));

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const currentItems = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '800', margin: '0', background: 'linear-gradient(to right, #818cf8, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>표준운송비 관리 대시보드</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '8px' }}>부품 마스터 및 운송 구간 기반 통합 관리 시스템</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button className="btn btn-outline" onClick={() => setShowAuthModal(true)}><Upload size={18} /> DB 업로드</button>
          <input type="file" hidden ref={fileInputRef} onChange={handleFileChange} accept=".xlsx, .xls" />
          <button className="btn btn-primary" onClick={() => window.location.href = `${API_BASE}/db/download`}><Download size={18} /> DB 다운로드</button>
        </div>
      </header>

      {showAuthModal && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ margin: 0 }}>관리자 인증 및 업로드 설정</h3>
              <X className="close-icon" onClick={() => setShowAuthModal(false)} />
            </div>
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <input type={showPw ? "text" : "password"} className="input-field" placeholder="관리자 비밀번호" value={authPw} onChange={e => setAuthPw(e.target.value)} />
              <div className="pw-toggle" onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff size={18} /> : <Eye size={18} />}</div>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '14px', marginBottom: '8px' }}>업로드 방식 선택:</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label className={`mode-label ${uploadMode === 'append' ? 'active' : ''}`}><input type="radio" checked={uploadMode === 'append'} onChange={() => setUploadMode('append')} /> 이어서 추가</label>
                <label className={`mode-label ${uploadMode === 'overwrite' ? 'active' : ''}`}><input type="radio" checked={uploadMode === 'overwrite'} onChange={() => setUploadMode('overwrite')} /> 초기화 후 덮어쓰기</label>
              </div>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', padding: '14px' }} onClick={() => authPw === "sewonsafe!" ? fileInputRef.current.click() : alert("비번 오류")}>파일 선택 및 업로드</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <button className={`tab-btn ${activeTab === 'calculate' ? 'active' : ''}`} onClick={() => setActiveTab('calculate')}><Calculator size={18} /> 운송비 산출 및 누적</button>
        <button className={`tab-btn ${activeTab === 'manage' ? 'active' : ''}`} onClick={() => setActiveTab('manage')}><Settings size={18} /> 부품 마스터 정보 등록</button>
        <button className={`tab-btn ${activeTab === 'predict' ? 'active' : ''}`} onClick={() => setActiveTab('predict')}><TrendingUp size={18} /> 운송비 예측 모델</button>
      </div>

      {activeTab === 'predict' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px' }}>
            <div className="card glass" style={{ height: '400px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart2 size={20} color="var(--primary)" /> 월간 총 운송비 누적 추이 (표준 vs 실제)</h3>
              <ResponsiveContainer width="100%" height="80%">
                <AreaChart data={costTrendData}>
                  <defs>
                    <linearGradient id="colorStd" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#818cf8" stopOpacity={0.3}/><stop offset="95%" stopColor="#818cf8" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorAct" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.3}/><stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" />
                  <YAxis tickFormatter={(val) => formatWonK(val)} stroke="var(--text-muted)" />
                  <Tooltip formatter={(val) => formatWon(val)} contentStyle={{ background: '#1e293b', border: '1px solid var(--border)', borderRadius: '8px' }} />
                  <Legend />
                  <Area type="monotone" dataKey="표준총액" stroke="#818cf8" fillOpacity={1} fill="url(#colorStd)" />
                  <Area type="monotone" dataKey="실제총액" stroke="#2dd4bf" fillOpacity={1} fill="url(#colorAct)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="card glass" style={{ height: '400px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Activity size={20} color="#ef4444" /> 개당 운반비(EA) 변동성 분석</h3>
              <ResponsiveContainer width="100%" height="80%">
                <LineChart data={costTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" />
                  <YAxis tickFormatter={(val) => formatWon(val)} stroke="var(--text-muted)" />
                  <Tooltip formatter={(val) => formatWon(val)} />
                  <Legend />
                  <Line type="stepAfter" dataKey="표준단가" stroke="#818cf8" strokeWidth={3} dot={{ r: 6 }} />
                  <Line type="monotone" dataKey="실제단가" stroke="#ef4444" strokeWidth={3} dot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="card glass" style={{ height: '400px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Target size={20} color="#fbbf24" /> 노선별 적재율 이탈 감지 (EA 기준)</h3>
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={loadingRateData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis type="number" stroke="var(--text-muted)" />
                  <YAxis dataKey="route" type="category" stroke="var(--text-muted)" width={70} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="표준적재" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="실제평균" fill="#fbbf24" radius={[0, 4, 4, 0]}>
                    {loadingRateData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.실제평균 < entry.표준적재 * 0.8 ? '#ef4444' : '#fbbf24'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card glass" style={{ height: '400px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}><Truck size={20} color="#c084fc" /> 표준 차종 준수율 (9.5TON 배차 이상 유무)</h3>
              <div style={{ display: 'flex', height: '100%', alignItems: 'center' }}>
                <ResponsiveContainer width="60%" height="90%">
                  <PieChart>
                    <Pie data={vehicleComplianceData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                      {vehicleComplianceData.map((entry, index) => <Cell key={`cell-${index}`} fill={VEHICLE_COLORS[index % VEHICLE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ width: '40%', paddingLeft: '20px' }}>
                  {vehicleComplianceData.map((entry, index) => (
                    <div key={entry.name} style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: VEHICLE_COLORS[index] }}></div>
                        {entry.name}
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: '800', marginLeft: '20px' }}>{entry.value} 건</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'center', opacity: 0.3, fontSize: '10px' }}>본 분석은 시뮬레이션 기반의 가상 데이터 모델이며, 실 정밀 예측 엔진은 개발 준비 중입니다.</div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '40px' }}>
            {activeTab === 'calculate' ? (
              <div className="card glass">
                <h3 style={{ marginTop: '0', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}><Calculator size={20} color="var(--accent)" /> 운송비 산출 입력</h3>
                <form onSubmit={handleCalculate} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <select className="input-field styled-select" value={calcForm.차종} onChange={e => setCalcForm({...calcForm, 차종: e.target.value})} required>
                    <option value="">차종 선택</option>
                    {parts.length > 0 && [...new Set(parts.map(p => p.차종))].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="input-field styled-select" value={calcForm.품명} onChange={e => setCalcForm({...calcForm, 품명: e.target.value})} required>
                    <option value="">품명 선택</option>
                    {parts.filter(p => p.차종 === calcForm.차종).map(p => <option key={p.품명} value={p.품명}>{p.품명}</option>)}
                  </select>
                  <select className="input-field styled-select" value={calcForm.납품차량} onChange={e => setCalcForm({...calcForm, 납품차량: e.target.value})}>
                    <option value="5TON">5TON</option><option value="8TON">8TON</option><option value="9.5TON">9.5TON</option><option value="11TON">11TON</option>
                  </select>
                  <input className="input-field" placeholder="출발지" value={calcForm.출발지} onChange={e => setCalcForm({...calcForm, 출발지: e.target.value})} />
                  <input className="input-field" placeholder="목적지" value={calcForm.목적지} onChange={e => setCalcForm({...calcForm, 목적지: e.target.value})} />
                  <div className="input-wrapper"><input className="input-field" type="number" placeholder="거리" value={calcForm.거리} onChange={e => setCalcForm({...calcForm, 거리: e.target.value})} required={!calcForm.isManualCost} /><span className="unit">km</span></div>
                  <div style={{ gridColumn: 'span 3', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}><input type="checkbox" checked={calcForm.isManualCost} onChange={e => setCalcForm({...calcForm, isManualCost: e.target.checked})} /> 1회 운송비 직접 입력</label>
                      {calcForm.isManualCost && <div className="input-wrapper" style={{ flex: 1 }}><input className="input-field" type="text" placeholder="금액 입력" value={formatNumber(calcForm.manualCost)} onChange={handleManualCostChange} required /><span className="unit">원</span></div>}
                    </div>
                    <button type="submit" className="btn-accent" style={{ padding: '14px 40px' }}>운송비 산출 및 DB 기록</button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="card glass">
                <h3 style={{ marginTop: '0', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}><Save size={20} color="var(--primary)" /> 신규 부품 등록</h3>
                <form onSubmit={handlePartSave}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', marginBottom: '16px' }}>
                    <input className="input-field" list="car-models" placeholder="차종" value={newPart.차종} onChange={e => setNewPart({...newPart, 차종: e.target.value})} required />
                    <datalist id="car-models">{parts.length > 0 && [...new Set(parts.map(p => p.차종))].map(c => <option key={c} value={c} />)}</datalist>
                    <input className="input-field" list="part-names" placeholder="품명" value={newPart.품명} onChange={e => setNewPart({...newPart, 품명: e.target.value})} required />
                    <datalist id="part-names">{parts.length > 0 && [...new Set(parts.map(p => p.품명))].map(p => <option key={p} value={p} />)}</datalist>
                    <button type="submit" className="btn btn-primary" style={{ padding: '0 30px' }}>부품 정보 DB 저장</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                    <input className="input-field" type="number" placeholder="용기 장" value={newPart.용기_장} onChange={e => setNewPart({...newPart, 용기_장: e.target.value})} required />
                    <input className="input-field" type="number" placeholder="용기 폭" value={newPart.용기_폭} onChange={e => setNewPart({...newPart, 용기_폭: e.target.value})} required />
                    <input className="input-field" type="number" placeholder="용기 고" value={newPart.용기_고} onChange={e => setNewPart({...newPart, 용기_고: e.target.value})} required />
                    <input className="input-field" type="number" placeholder="적입수량" value={newPart.적입수량} onChange={e => setNewPart({...newPart, 적입수량: e.target.value})} required />
                  </div>
                </form>
              </div>
            )}
          </div>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: '0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeTab === 'calculate' ? <HistoryIcon size={20} color="var(--primary)" /> : <CheckCircle size={20} color="var(--primary)" />}
                {activeTab === 'calculate' ? '운송비 관리 이력' : '부품별 DB 목록'}
              </h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ position: 'relative' }}><Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} /><input className="input-field" style={{ paddingLeft: '40px', width: '250px' }} placeholder="차종, 품명을 검색" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div>
                {(activeTab === 'calculate' ? selectedIds : selectedPartIds).length > 0 && <button className="btn btn-danger" onClick={() => handleDelete(activeTab === 'calculate' ? 'history' : 'parts')}><Trash2 size={18} /> 선택 삭제</button>}
              </div>
            </div>
            <div className="table-container" style={{ maxHeight: '600px', overflowY: 'auto', background: 'var(--card-bg)' }}>
              {activeTab === 'calculate' ? (
                <table>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1e293b' }}>
                    <tr><th><input type="checkbox" onChange={e => setSelectedIds(e.target.checked ? currentItems.map(h => h.id) : [])} /></th><th>기록일시</th><th>차종</th><th>품명</th><th>출발지</th><th>목적지</th><th>거리</th><th>차량</th><th>1회 운송비</th><th>상차 PLT</th><th>개당 운송비</th><th>추천 상차방법</th></tr>
                  </thead>
                  <tbody>{currentItems.map(h => (<tr key={h.id}><td><input type="checkbox" checked={selectedIds.includes(h.id)} onChange={e => setSelectedIds(prev => e.target.checked ? [...prev, h.id] : prev.filter(id => id !== h.id))} /></td><td style={{fontSize:'12px'}}>{formatDateTime(h.기록일시)}</td><td>{h.차종}</td><td style={{fontWeight:'600'}}>{h.품명}</td><td>{h.출발지}</td><td>{h.목적지}</td><td>{h.거리}km</td><td>{h.납품차량}</td><td>₩{h.일회_운송비?.toLocaleString()}</td><td>{h.상차_PLT}</td><td style={{color:'var(--success)',fontWeight:'700'}}>₩{h.개당_운송비?.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}</td><td style={{fontSize:'12px'}}>{h.추천_상차방법}</td></tr>))}</tbody>
                </table>
              ) : (
                <table>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1e293b' }}>
                    <tr><th><input type="checkbox" onChange={e => setSelectedPartIds(e.target.checked ? currentItems.map(p => p.id) : [])} /></th><th>차종</th><th>품명</th><th>용기 장</th><th>용기 폭</th><th>용기 고</th><th>적입수량</th></tr>
                  </thead>
                  <tbody>{currentItems.map(p => (<tr key={p.id}><td><input type="checkbox" checked={selectedPartIds.includes(p.id)} onChange={e => setSelectedPartIds(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))} /></td><td>{p.차종}</td><td style={{fontWeight:'600'}}>{p.품명}</td><td>{p.용기_장}</td><td>{p.용기_폭}</td><td>{p.용기_고}</td><td>{p.적입수량} EA</td></tr>))}</tbody>
                </table>
              )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
              <button className="page-btn" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1}><ChevronLeft size={20} /></button>
              <span style={{ fontWeight: '600', color: 'var(--text-muted)' }}>{currentPage} / {totalPages || 1} 페이지</span>
              <button className="page-btn" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0}><ChevronRight size={20} /></button>
            </div>
          </div>
        </>
      )}
      {loading && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div className="loader"></div>
          <p style={{ color: 'white', marginTop: '20px', fontWeight: '700' }}>관리자 권한으로 데이터를 업로드 중입니다...</p>
        </div>
      )}
      <style>{`
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { width: 450px; padding: 32px; border-radius: 16px; border: 1px solid var(--border); }
        .close-icon { cursor: pointer; color: var(--text-muted); }
        .pw-toggle { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); cursor: pointer; color: var(--text-muted); }
        .mode-label { flex: 1; display: flex; align-items: center; gap: 8px; padding: 12px; border: 1px solid var(--border); border-radius: 8px; font-size: 13px; cursor: pointer; transition: all 0.2s; }
        .mode-label.active { border-color: var(--primary); background: rgba(99, 102, 241, 0.1); }
        .tab-btn { display: flex; align-items: center; gap: 8px; padding: 12px 24px; background: transparent; border: none; color: var(--text-muted); font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
        .tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); background: rgba(99, 102, 241, 0.05); }
        .page-btn { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 8px; border: 1px solid var(--border); background: transparent; color: white; cursor: pointer; transition: all 0.2s; }
        .page-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); border-color: var(--primary); }
        .page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .input-wrapper { position: relative; width: 100%; }
        .input-wrapper .unit { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 14px; font-weight: 600; pointer-events: none; }
        .input-field { background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border); border-radius: 8px; padding: 12px; color: white; outline: none; width: 100%; }
        .styled-select option { background: white; color: black; }
        .btn-accent { background: var(--accent); color: white; border-radius: 8px; font-weight: 700; border: none; cursor: pointer; }
        .btn-danger { background: #ef4444; color: white; display: flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; }
        .loader { border: 4px solid #f3f3f3; border-top: 4px solid var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
export default App;
