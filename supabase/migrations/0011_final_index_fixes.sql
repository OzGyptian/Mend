-- Two FK columns missed when 0007 was first written (created_by, enterprise_id
-- on both subcontracts and invoices) -- caught by the performance advisor
-- after the full 26-collection schema was in place. Already folded into
-- 0007's own index block for anyone reading these files fresh; kept as its
-- own migration too since it's what was actually run, in order.
create index on invoices (created_by);
create index on invoices (enterprise_id);
create index on subcontracts (created_by);
create index on subcontracts (enterprise_id);
