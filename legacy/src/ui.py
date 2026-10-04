"""Shared presentation helpers for the Streamlit dashboard."""
import streamlit as st


def apply_theme():
    st.markdown("""
    <style>
      :root { --ink:#14213d; --muted:#64748b; --navy:#0b1f3a; --blue:#2563eb; --sky:#eaf3ff; --mint:#10b981; --line:#e2e8f0; }
      .stApp { background: #f7f9fc; color: var(--ink); }
      .block-container { max-width: 1440px; padding: 2.4rem 3.2rem 4rem; }
      [data-testid="stSidebar"] { background: #0b1f3a; border-right: 0; }
      [data-testid="stSidebar"] * { color: #eef6ff !important; }
      [data-testid="stSidebar"] [data-baseweb="select"] *, [data-testid="stSidebar"] input { color: #172033 !important; }
      [data-testid="stSidebar"] [data-baseweb="tag"] { background: #1d4ed8 !important; border: 0 !important; }
      [data-testid="stSidebar"] .stSlider [data-testid="stTickBar"] { color: #94a3b8 !important; }
      [data-testid="stSidebarNav"] { padding-top: .75rem; }
      [data-testid="stSidebarNav"] { display:none; }
      [data-testid="stSidebarNav"] a { border-radius: 10px; margin: 4px 10px; font-weight: 600; }
      [data-testid="stSidebarNav"] a:hover, [data-testid="stSidebarNav"] a[aria-current="page"] { background:#173b6a; }
      h1,h2,h3 { color: var(--ink) !important; letter-spacing:-.03em; }
      h1 { font-size: 2.25rem !important; margin-bottom: .25rem !important; }
      .hero { background: radial-gradient(circle at 90% 10%, #1d73db 0, #102a4b 43%, #091a31 100%); border-radius:22px; padding:32px 38px; color:white; min-height:210px; box-shadow:0 14px 32px rgba(15,39,71,.14); }
      .hero h1 { color:#fff !important; font-size:2.65rem !important; max-width:760px; margin: 8px 0 !important; }
      .hero p { color:#cbdcf4; font-size:1.02rem; max-width:680px; margin:0; }
      .eyebrow { display:inline-block; color:#bbf7d0; font-size:.73rem; font-weight:800; letter-spacing:.12em; }
      .metric-card { background:#fff; border:1px solid var(--line); border-radius:15px; padding:17px 18px; min-height:104px; box-shadow:0 3px 10px rgba(15,23,42,.03); }
      .metric-label { color:var(--muted); font-size:.79rem; font-weight:700; text-transform:uppercase; letter-spacing:.07em; }
      .metric-value { color:var(--ink); font-size:1.9rem; font-weight:800; margin-top:5px; letter-spacing:-.04em; }
      .metric-note { color:#10b981; font-size:.76rem; margin-top:3px; font-weight:600; }
      .panel-title { margin:0 0 2px; font-size:1.12rem; font-weight:800; color:var(--ink); }
      .panel-subtitle { margin:0 0 12px; font-size:.87rem; color:var(--muted); }
      .insight { background:#fff; border:1px solid var(--line); border-radius:15px; padding:18px; margin-bottom:12px; }
      .insight-number { color:#2563eb; font-size:1.55rem; font-weight:800; }
      div[data-testid="stPlotlyChart"] { background:#fff; border:1px solid var(--line); border-radius:15px; padding:6px; }
      [data-testid="stDataFrame"] { border:1px solid var(--line); border-radius:12px; overflow:hidden; }
      .stButton>button { border-radius:9px; background:#2563eb; color:white; border:0; font-weight:700; }
      .stAlert { border-radius:12px; }
      @media(max-width: 900px) { .block-container { padding:1.4rem 1rem 3rem; } .hero { padding:26px; } .hero h1 { font-size:2rem !important; } }
    </style>
    """, unsafe_allow_html=True)


def page_header(kicker, title, subtitle):
    navigation(include_home=False)
    st.markdown(f'<div class="eyebrow" style="color:#2563eb">{kicker}</div><h1>{title}</h1><p style="color:#64748b;margin-top:-.2rem;margin-bottom:1.35rem">{subtitle}</p>', unsafe_allow_html=True)


def navigation(include_home=True):
    """Compact task navigation; replaces Streamlit's opaque page list."""
    labels=[("app.py","Overview"),("pages/1_Overview.py","Infrastructure"),("pages/2_Network_Analysis.py","Network"),("pages/3_Route_Optimization.py","Route"),("pages/6_Resilience.py","Resilience"),("pages/4_Accessibility.py","Access"),("pages/5_Recommendations.py","Expand"),("pages/7_Methodology.py","Methods")]
    if not include_home: labels=labels[1:]
    cols=st.columns(len(labels),gap="small")
    for col,(path,label) in zip(cols,labels):
        with col: st.page_link(path,label=label,use_container_width=True)


def metric_card(label, value, note=""):
    st.markdown(f'<div class="metric-card"><div class="metric-label">{label}</div><div class="metric-value">{value}</div><div class="metric-note">{note}</div></div>', unsafe_allow_html=True)
