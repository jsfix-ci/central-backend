// Copyright 2022 ODK Central Developers
// See the NOTICE file at the top-level directory of this distribution and at
// https://github.com/getodk/central-backend/blob/master/NOTICE.
// This file is part of ODK Central. It is subject to the license terms in
// the LICENSE file found in the top-level directory of this distribution and at
// https://www.apache.org/licenses/LICENSE-2.0. No part of ODK Central,
// including this file, may be copied, modified, propagated, or distributed
// except according to the terms contained in the LICENSE file.

const csv = require('csv-stringify');
const { Transform } = require('stream');
const { PartialPipe } = require('../util/stream');
const { submissionXmlToFieldStream } = require('./submission');

////////////////////////////////////////////////////////////////////////////
// ENTITY PARSING

// This works similarly to processing submissions for export, but also note:
// 1. this is expecting the entityFields to be filled in with propertyName attributes
// 2. the "meta/entity" structural field should be included to get necessary
//    entity node attributes like dataset name.
const parseSubmissionXml = (entityFields, xml) => new Promise((resolve, reject) => {
  const entity = { system: {}, data: {} };
  const stream = submissionXmlToFieldStream(entityFields, xml, true);
  stream.on('error', reject);
  stream.on('data', ({ field, text }) => {
    if (field.name === 'entity' && field.attrs !== {}) {
      entity.system.dataset = (field.attrs.dataset ? field.attrs.dataset : field.attrs['entities:dataset']);
    } else if (field.path.indexOf('/meta/entity') === 0)
      entity.system[field.name] = text;
    else if (field.propertyName != null)
      entity.data[field.propertyName] = text;
  });
  stream.on('end', () => resolve(entity));
});


////////////////////////////////////////////////////////////////////////////
// ENTITY STREAMING

const formatRow = (entity, props) => {
  const out = [];
  out.push(entity.uuid);
  out.push(entity.label);
  for (const prop of props) out.push(entity.def.data[prop]);
  return out;
};

const streamEntityCsvs = (inStream, properties) => {
  const header = [ 'name', 'label' ];
  const props = [];

  for (let idx = 0; idx < properties.length; idx += 1) {
    const field = properties[idx];
    const prop = field.name;
    header.push(prop);
    props.push(prop);
  }

  let rootHeaderSent = false;
  const rootStream = new Transform({
    objectMode: true,
    transform(entity, _, done) {
      try {
        if (rootHeaderSent === false) {
          this.push(header);
          rootHeaderSent = true;
        }
        this.push(formatRow(entity, props));
        done();
      } catch (ex) { done(ex); }
    }, flush(done) {
      if (rootHeaderSent === false) this.push(header);
      done();
    }
  });

  return PartialPipe.of(inStream, rootStream, csv());
};


module.exports = { parseSubmissionXml, streamEntityCsvs };
