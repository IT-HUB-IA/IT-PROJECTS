class Repositorio {
  void gravar(java.sql.Connection c) throws Exception {
    c.prepareStatement("insert into pedidos (cliente_id, total, desconto) values (?, ?, ?)").execute();
    c.prepareStatement("update pedidos set status = ? where id = ?").execute();
  }
}
