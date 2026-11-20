import polars as pl, numpy as np
def load():
    df=pl.read_csv('crawl.tsv',separator='\t',has_header=False,new_columns=['tc','wr','br','wa','ba','plies','res','tcs','url'],schema_overrides={'tcs':pl.Utf8}).unique('url')
    a=df.select('tc',pl.col('wr').alias('r'),pl.col('br').alias('ro'),pl.col('wa').alias('acc'),pl.col('ba').alias('acco'),'plies','url')
    b=df.select('tc',pl.col('br').alias('r'),pl.col('wr').alias('ro'),pl.col('ba').alias('acc'),pl.col('wa').alias('acco'),'plies','url')
    return pl.concat([a,b]).filter(pl.col('plies')>=20)
