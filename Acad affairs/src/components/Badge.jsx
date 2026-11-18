import React from 'react';

export function Badge({children, kind="neutral"}) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}

export function statusBadge(status){
  const map = {
    published: ["Published","success"], draft: ["Draft","warn"], conflict: ["Conflict","alert"],
    scheduled: ["Scheduled","gold"], pending: ["Pending","neutral"],
  };
  const [label,kind] = map[status] || [status,"neutral"];
  return <Badge kind={kind}>{label}</Badge>;
}
