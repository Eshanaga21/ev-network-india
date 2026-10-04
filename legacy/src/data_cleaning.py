import pandas as pd

SCHEMA = ["station_id","station_name","latitude","longitude","city","state","country","operator","charger_type","connector_type","num_chargers","charging_power_kw","status","access_type","fast_chargers","level2_chargers"]
ALIASES = {"ID":"station_id","Station Name":"station_name","Latitude":"latitude","Longitude":"longitude","City":"city","State":"state","Country":"country","EV Network":"operator","EV Connector Types":"connector_type","Status Code":"status","Groups With Access Code":"access_type","EV DC Fast Count":"fast_chargers","EV Level2 EVSE Num":"level2_chargers","stationid":"station_id","name":"station_name","lattitude":"latitude","availability":"status","type":"charger_type"}

def clean_stations(raw):
    """Standardise data and return clean frame plus transparent cleaning audit."""
    before=len(raw); df=raw.rename(columns={k:v for k,v in ALIASES.items() if k in raw.columns}).copy()
    for col in SCHEMA:
        if col not in df: df[col] = None
    df=df[SCHEMA]; df["latitude"]=pd.to_numeric(df.latitude,errors="coerce"); df["longitude"]=pd.to_numeric(df.longitude,errors="coerce")
    invalid=~df.latitude.between(-90,90) | ~df.longitude.between(-180,180) | df.latitude.isna() | df.longitude.isna()
    invalid_count=int(invalid.sum()); df=df[~invalid].copy()
    duplicates=int(df.duplicated("station_id").sum()); df=df.drop_duplicates("station_id")
    # E-Amrit extract does not report port counts or power. Never impute them.
    for c in ["fast_chargers","level2_chargers"]: df[c]=pd.to_numeric(df[c],errors="coerce").fillna(0).clip(lower=0)
    df["num_chargers"]=(df.fast_chargers+df.level2_chargers).astype(int)
    df["charging_power_kw"]=pd.to_numeric(df["charging_power_kw"],errors="coerce")
    # Retain source categories where no connector detail is published.
    no_port_detail=(df.fast_chargers+df.level2_chargers)==0
    df["charger_type"]=df.apply(lambda r: "DC Fast + Level 2" if r.fast_chargers and r.level2_chargers else ("DC Fast" if r.fast_chargers else "Level 2"),axis=1)
    df.loc[no_port_detail,"charger_type"]="Not reported by source"
    for c in ["station_name","city","state","country","operator","charger_type","connector_type","status","access_type"]:
        df[c]=df[c].fillna("Unknown").astype(str).str.strip().replace("", "Unknown")
    df.loc[df.country.eq("Unknown"),"country"]="India"
    df["status"]=df.status.replace({"1":"Reported available","0":"Not reported available"})
    generated_ids=pd.Series("station-"+df.index.astype(str), index=df.index)
    df.station_id=df.station_id.fillna(generated_ids).astype(str)
    return df.reset_index(drop=True), {"total_raw_records":before,"valid_station_records":len(df),"invalid_coordinates_removed":invalid_count,"duplicate_ids_removed":duplicates,"ports_reported":int(df.num_chargers.sum()),"charging_power_missing":int(df.charging_power_kw.isna().sum())}
